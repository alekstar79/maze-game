import { LIMITS } from '../lib/constants'
import { generateMaze, measureSolutionLength } from '../lib/grid'
import { computeLayout, createRenderer, type CanvasColors, type MazeLayout } from './renderer'
import { solveMaze } from '../lib/search'
import { resolveMove, isPassable, isAtExit, type Move } from '../lib/player'

/**
 * Фаза игры.
 *
 * - `'idle'` — лабиринт сгенерирован и нарисован, управление отключено, ожидается `startGame()`.
 * - `'playing'` — игра активна: перемещения и (в Demo) автопоиск разрешены.
 * - `'finished'` — игра завершена (победа, таймаут или внешний `endGame()`);
 *   управление отключено до следующего `startGame()`/`reset()`.
 */
export type MazePhase = 'idle' | 'playing' | 'finished'

/**
 * Состояние игры.
 *
 * @property {number} nx - Текущее число столбцов.
 * @property {number} ny - Текущее число строк.
 * @property {MazeLayout} layout - Геометрия сетки на canvas.
 * @property {Array<Array<number>>} grid - Сетка битовых масок стен.
 * @property {number} playerX - Столбец игрока.
 * @property {number} playerY - Строка игрока.
 * @property {number} exitY - Строка выхода.
 * @property {MazePhase} phase - Фаза (см. `MazePhase`).
 * @property {boolean} allowSearch - Разрешён ли автопоиск. Управляется `main.js` из режима таймера (Demo → `true`, Timed → `false`).
 * @property {Array<{x: number, y: number}>} pathCells - Клетки подсвеченного пути от текущей позиции игрока до выхода.
 *   Источник правды для отрисовки пути при `redraw()`. Заполняется `startSearch()`, опустошается `reset()`;
 *   `tryMove()` удаляет из него покинутую клетку.
 */
export interface MazeGameState {
  nx: number
  ny: number
  layout: MazeLayout
  grid: number[][]
  playerX: number
  playerY: number
  exitY: number
  phase: MazePhase
  allowSearch: boolean
  pathCells: Array<{ x: number, y: number }>
}

/**
 * Информация о старте игры, передаваемая в `onStart`.
 */
export interface StartInfo {
  nx: number
  ny: number
  solutionLength: number
}

/**
 * Публичный API игры.
 *
 * @property {MazeGameState} state - Состояние игры.
 * @property {(columns?: number, rows?: number) => void} reset Сбрасывает игру в фазу `'idle'`; аргументы `columns`, `rows`.
 * @property {(columns?: number, rows?: number) => void} startGame Регенерирует лабиринт и запускает игру (фаза `'playing'`).
 * @property {() => void} endGame - Завершает игру (фаза `'finished'`).
 * @property {() => void} startSearch - Синхронно подсвечивает путь от игрока до выхода (если разрешён).
 * @property {() => void} redraw - Идемпотентно перерисовывает сцену из текущего `state` без его мутации; используется при смене темы.
 * @property {(event: KeyboardEvent) => void} handleKeyDown
 * @property {() => boolean} isAtExit
 */
export interface MazeGame {
  state: MazeGameState
  reset(columns?: number, rows?: number): void
  startGame(columns?: number, rows?: number): void
  endGame(): void
  startSearch(): void
  redraw(): void
  handleKeyDown(event: KeyboardEvent): void
  isAtExit(): boolean
}

/**
 * Колбэк старта игры.
 *
 * @callback OnStartCallback
 * @param {{ nx: number, ny: number, solutionLength: number }} info
 * @returns {void}
 */
export type OnStartCallback = (info: StartInfo) => void

/**
 * Колбэк победы. Вызывается ровно один раз при достижении выхода.
 *
 * @callback OnWinCallback
 * @returns {void}
 */
export type OnWinCallback = () => void

/**
 * Опции создания игры.
 *
 * @property {number} [width=800] - Ширина canvas в пикселях.
 * @property {number} [height=500] - Высота canvas в пикселях.
 * @property {number} [columns=10] - Начальное число столбцов.
 * @property {number} [rows=8] - Начальное число строк.
 * @property {() => CanvasColors} getColors - Функция, возвращающая текущую палитру Canvas (см. `getCanvasColors` в `src/app/theme.js`).
 * @property {OnStartCallback} [onStart] - Уведомление о старте с длиной решения, чтобы `main.js` рассчитал лимит Timed.
 * @property {OnWinCallback} [onWin] - Колбэк, вызываемый при победе; вся пост-обработка победы (UI, статистика) — на стороне вызывающего кода.
 */
export interface UseMazeGameOptions {
  width?: number
  height?: number
  columns?: number
  rows?: number
  getColors: () => CanvasColors
  onStart?: OnStartCallback
  onWin?: OnWinCallback
}

/**
 * Создаёт игру-лабиринт на указанном canvas.
 *
 * Устанавливает размеры canvas, создаёт состояние и рендерер, затем выполняет начальный `reset` (фаза `'idle'`).
 * Игра переходит в `'playing'` только после явного вызова `startGame()`.
 *
 * Цвета Canvas рендерер получает через обязательный `options.getColors`.
 * Единственный источник правды — CSS-токены `--color-canvas-*`.
 *
 * @param {HTMLCanvasElement} canvas - Canvas для отрисовки.
 * @param {UseMazeGameOptions} options - Настройки.
 * @returns {MazeGame} Публичный API игры.
 * @throws {TypeError} Если `options.getColors` не передан или не является функцией.
 */
export function useMazeGame(
  canvas: HTMLCanvasElement,
  options: UseMazeGameOptions
): MazeGame {
  const width = options.width ?? 800
  const height = options.height ?? 500
  const initialColumns = options.columns ?? 10
  const initialRows = options.rows ?? 8
  const onStart: OnStartCallback | null = options.onStart ?? null
  const onWin: OnWinCallback | null = options.onWin ?? null
  const getColors = options.getColors

  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('2D canvas context is not available')
  }
  const renderer = createRenderer(ctx, getColors)

  const state: MazeGameState = {
    nx: initialColumns,
    ny: initialRows,
    layout: computeLayout(width, height, initialColumns, initialRows),
    grid: [],
    playerX: 0,
    playerY: 0,
    exitY: 0,
    phase: 'idle',
    allowSearch: true,
    pathCells: []
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
  }

  /**
   * Идемпотентная перерисовка всей сцены из текущего `state`.
   *
   * Единая точка отрисовки для операций, которые меняют состояние крупными блоками (`reset`, `startSearch`),
   * и для внешних вызовов, которым нужно перерисовать сцену без изменения состояния (смена темы).
   * Инвариант: `redraw()` не мутирует `state`, не вызывает callback'и (`onStart`, `onWin`),
   * не дёргает таймер, не пишет в `localStorage` и не пересоздаёт `canvas`/`ctx`.
   * При неизменном `state` и неизменной палитре повторный вызов даёт визуально идентичный результат.
   *
   * Порядок слоёв: фон → рамка → стены → выход → путь → игрок.
   * Игрок рисуется поверх пути: если игрок стоит на клетке пути, маркер перекрывает подсветку.
   *
   * @returns {void}
   */
  function redraw(): void {
    renderer.clear(width, height)
    renderer.drawBorder(state.layout, state.nx, state.ny)
    renderer.drawWalls(state.layout, state.grid, state.nx, state.ny)
    renderer.openExit(state.layout, state.nx, state.exitY)

    for (const cell of state.pathCells) {
      renderer.markPath(state.layout, cell.x, cell.y)
    }

    renderer.drawPlayer(state.layout, state.playerX, state.playerY)
  }

  /**
   * Сбрасывает игру и генерирует новый лабиринт; переводит в `'idle'`.
   *
   * Порядок: ограничение размеров, вычисление layout, выбор строки выхода, сброс позиции игрока,
   * генерация сетки, очистка подсвеченного пути, сброс фазы в `'idle'`, полная перерисовка через `redraw()`.
   *
   * [OPEN Q-002: значения `columns`/`rows`, не являющиеся конечными числами,
   * не валидируются; поведение при `NaN`/`Infinity` кодом не определено.]
   *
   * @param {number} [columns=state.nx] - Желаемое число столбцов.
   * @param {number} [rows=state.ny] - Желаемое число строк.
   * @returns {void}
   */
  function reset(columns = state.nx, rows = state.ny): void {
    state.nx = clamp(Math.floor(columns), LIMITS.minColumns, LIMITS.maxColumns)
    state.ny = clamp(Math.floor(rows), LIMITS.minRows, LIMITS.maxRows)

    state.layout = computeLayout(width, height, state.nx, state.ny)
    state.exitY = Math.floor(state.ny / 2)
    state.playerX = 0
    state.playerY = state.exitY
    state.grid = generateMaze(state.nx, state.ny)
    state.pathCells = []
    state.phase = 'idle'

    redraw()
  }

  /**
   * Запускает игру: генерирует новый лабиринт, замеряет длину пути и переводит состояние в `'playing'`.
   *
   * По завершении вызывает `onStart({nx, ny, solutionLength})`, чтобы вызывающий код рассчитал лимит Timed и запустил таймер.
   *
   * @param {number} [columns=state.nx] - Желаемое число столбцов.
   * @param {number} [rows=state.ny] - Желаемое число строк.
   * @returns {void}
   */
  function startGame(columns = state.nx, rows = state.ny): void {
    reset(columns, rows)

    const solutionLength = measureSolutionLength(
      state.grid,
      state.nx,
      state.ny,
      state.playerX,
      state.playerY,
      state.nx - 1,
      state.exitY
    )

    state.phase = 'playing'

    if (onStart) {
      onStart({ nx: state.nx, ny: state.ny, solutionLength })
    }
  }

  /**
   * Внешнее завершение игры (например, таймаут в `main.js`).
   *
   * Отключает управление. Повторный вызов — no-op.
   *
   * @returns {void}
   */
  function endGame(): void {
    if (state.phase === 'finished') return
    state.phase = 'finished'
  }

  /**
   * Синхронно находит путь от текущей позиции игрока до выхода и подсвечивает его.
   *
   * Работает только если поиск разрешён (`state.allowSearch`) и игра в фазе `'playing'`.
   * Игрок не перемещается — путь только запоминается в `state.pathCells` и сразу отрисовывается через `redraw()`.
   * Повторный вызов заменяет `pathCells` новым путём от текущей позиции (если игрок успел сдвинуться — от новой).
   * Если путь не найден — no-op (в корректном лабиринте недостижимо).
   *
   * Автопоиск разрешён только в Demo-режиме; флаг `state.allowSearch` выставляет `main.js` при смене режима.
   *
   * @returns {void}
   */
  function startSearch(): void {
    if (!state.allowSearch) return
    if (state.phase !== 'playing') return

    const result = solveMaze({
      grid: state.grid,
      nx: state.nx,
      ny: state.ny,
      startX: state.playerX,
      startY: state.playerY,
      exitY: state.exitY
    })

    if (!result.found) return

    state.pathCells = result.path.map(({ x, y }) => ({ x, y }))
    redraw()
  }

  /**
   * Пытается переместить игрока на один шаг.
   *
   * Если стена в направлении хода отсутствует, стирает текущую клетку, удаляет её из `state.pathCells`
   * (чтобы при последующей перерисовке — например, при смене темы — путь не «воскрешал» позади игрока),
   * меняет координаты игрока, рисует его в новой клетке и возвращает `true`.
   * Иначе состояние и canvas не меняются, возвращается `false`.
   *
   * Отрисовка точечная (`eraseCell` + `drawPlayer`), а не через `redraw()`:
   * ход меняет две клетки, полная перерисовка на горячем пути избыточна.
   *
   * @param {{dx: number, dy: number, wall: number}} move - Описание хода.
   * @returns {boolean} `true`, если перемещение выполнено.
   */
  function tryMove(move: Move): boolean {
    if (!isPassable(state.grid, state.playerX, state.playerY, move)) return false

    const prevX = state.playerX
    const prevY = state.playerY

    renderer.eraseCell(state.layout, prevX, prevY)
    state.playerX += move.dx
    state.playerY += move.dy

    const pathIndex = state.pathCells.findIndex(
      (cell) => cell.x === prevX && cell.y === prevY
    )
    if (pathIndex !== -1) {
      state.pathCells.splice(pathIndex, 1)
    }

    renderer.drawPlayer(state.layout, state.playerX, state.playerY)
    return true
  }

  /**
   * Обрабатывает нажатие клавиши для управления игрой.
   *
   * Ходы принимаются только в фазе `'playing'`. Клавиша `S`/`s` запускает автопоиск (если `allowSearch`).
   * Стрелки пытаются переместить игрока. При достижении выхода фаза меняется на `'finished'` и вызывается `onWin()`.
   *
   * @param {KeyboardEvent} event - Событие клавиатуры.
   * @returns {void}
   */
  function handleKeyDown(event: KeyboardEvent): void {
    if (event.defaultPrevented) return
    if (state.phase !== 'playing') return

    if (event.key === 's' || event.key === 'S') {
      event.preventDefault()
      startSearch()
      return
    }

    const move = resolveMove(event.key)
    if (!move) {
      return
    }

    event.preventDefault()

    if (tryMove(move) && isAtExit(state)) {
      state.phase = 'finished'
      if (onWin) onWin()
    }
  }

  reset(initialColumns, initialRows)

  return {
    state,
    reset,
    startGame,
    endGame,
    startSearch,
    redraw,
    handleKeyDown,
    isAtExit: () => isAtExit(state)
  }
}
