import { WALL } from './constants'

/**
 * Описание одного хода: смещение по сетке и бит стены, который блокирует ход.
 */
export interface Move {
  dx: number
  dy: number
  wall: number
}

/**
 * Соответствие клавиш стрелок смещению игрока и стене, которая блокирует ход.
 *
 * Для каждой стрелки задано смещение по сетке и бит стены текущей клетки,
 * который проверяется перед перемещением. Объект заморожен.
 *
 * @constant
 * @type {Readonly<Object<string, {dx: number, dy: number, wall: number}>>}
 */
const MOVES: Readonly<Record<string, Move>> = {
  ArrowUp: { dx: 0, dy: -1, wall: WALL.TOP },
  ArrowLeft: { dx: -1, dy: 0, wall: WALL.LEFT },
  ArrowDown: { dx: 0, dy: 1, wall: WALL.BOTTOM },
  ArrowRight: { dx: 1, dy: 0, wall: WALL.RIGHT }
}

/**
 * Возвращает описание хода для клавиши стрелки.
 *
 * @param {string} key - Значение `KeyboardEvent.key`.
 * @returns {{dx: number, dy: number, wall: number}|null} Описание хода или `null`, если клавиша не является стрелкой.
 */
export function resolveMove(key: string): Move | null {
  return MOVES[key] ?? null
}

/**
 * Проверяет, свободна ли стена в направлении хода.
 *
 * Функция не проверяет границы сетки: предполагается, что `x` и `y`
 * указывают на существующую клетку. Проверяется только бит стены,
 * заданный в `move.wall`.
 *
 * @param {Array<Array<number>>} grid - Сетка битовых масок стен.
 * @param {number} x - Индекс столбца текущей клетки.
 * @param {number} y - Индекс строки текущей клетки.
 * @param {{dx: number, dy: number, wall: number}} move - Описание хода.
 * @returns {boolean} `true`, если стена отсутствует.
 * @throws {TypeError} Если `grid[x]` не существует (нарушено предусловие).
 */
export function isPassable(
  grid: number[][],
  x: number,
  y: number,
  move: Move
): boolean {
  return (grid[x][y] & move.wall) === 0
}

/**
 * Минимальная проекция состояния игры для проверки выхода.
 */
export interface ExitCheckState {
  playerX: number
  playerY: number
  nx: number
  exitY: number
}

/**
 * Проверяет, стоит ли игрок в клетке выхода.
 *
 * Выход расположен в последнем столбце (`nx - 1`) на строке `exitY`.
 *
 * @param {ExitCheckState} state - Состояние игры.
 * @param {number} state.playerX - Столбец игрока.
 * @param {number} state.playerY - Строка игрока.
 * @param {number} state.nx - Количество столбцов.
 * @param {number} state.exitY - Строка выхода.
 * @returns {boolean} `true`, если координаты игрока совпадают с клеткой выхода.
 */
export function isAtExit(state: ExitCheckState): boolean {
  return state.playerX === state.nx - 1 && state.playerY === state.exitY
}
