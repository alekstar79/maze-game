import { WALL } from '../lib/constants'

/**
 * Рендерер игрового поля.
 *
 * Палитра цветов не является частью рендерера: единственный источник правды для цветов поля — CSS-токены `--color-canvas-*` в theme-блоках `src/styles/index.css`.
 * Рендерер получает их через callback `getColors` при каждой отрисовке, что позволяет перерисовывать сцену при смене темы (`redraw()` в `src/app/game.js`) без
 * пересоздания рендерера и без дублирования цветов в JS.
 */

/**
 * Геометрия сетки на canvas.
 *
 * @property {number} cellWidth - Ширина клетки в пикселях.
 * @property {number} cellHeight - Высота клетки в пикселях.
 * @property {number} originX - X-координата начала сетки.
 * @property {number} originY - Y-координата начала сетки.
 */
export interface MazeLayout {
  cellWidth: number
  cellHeight: number
  originX: number
  originY: number
}

/**
 * Палитра цветов Canvas для отрисовки лабиринта.
 *
 * Значения читаются из CSS custom properties `--color-canvas-*` в момент вызова draw-метода.
 * Контракт «актуальная палитра» обеспечивает вызывающий код: см. `getCanvasColors` в `src/app/theme.js`.
 *
 * @property {string} background - Фон клетки (используется в `openExit` и `eraseCell`); сам canvas не заливается фоном — прозрачен.
 * @property {string} wall - Цвет стен и внешней рамки.
 * @property {string} explored - Цвет исследованных клеток.
 * @property {string} path - Цвет найденного пути.
 * @property {string} playerFill - Заливка маркера игрока.
 * @property {string} playerStroke - Обводка маркера игрока.
 */
export interface CanvasColors {
  background: string
  wall: string
  explored: string
  path: string
  playerFill: string
  playerStroke: string
}

/**
 * Набор методов отрисовки лабиринта.
 *
 * Все методы читают цвета из текущей палитры (`getColors()`), а не из снимка, сделанного при создании рендерера.
 * Это позволяет перерисовывать сцену при смене темы без пересоздания рендерера.
 *
 * @property {(width: number, height: number) => void} clear
 * @property {(layout: MazeLayout, x: number, y: number, fillColor: string, strokeColor: string) => void} fillCell
 * @property {(layout: MazeLayout, x: number, y: number) => void} eraseCell
 * @property {(layout: MazeLayout, x: number, y: number) => void} markExplored
 * @property {(layout: MazeLayout, x: number, y: number) => void} markPath
 * @property {(layout: MazeLayout, x: number, y: number) => void} drawPlayer
 * @property {(layout: MazeLayout, nx: number, ny: number) => void} drawBorder
 * @property {(layout: MazeLayout, grid: number[][], nx: number, ny: number) => void} drawWalls
 * @property {(layout: MazeLayout, nx: number, exitY: number) => void} openExit
 */
export interface MazeRenderer {
  clear(width: number, height: number): void
  fillCell(layout: MazeLayout, x: number, y: number, fillColor: string, strokeColor: string): void
  eraseCell(layout: MazeLayout, x: number, y: number): void
  markExplored(layout: MazeLayout, x: number, y: number): void
  markPath(layout: MazeLayout, x: number, y: number): void
  drawPlayer(layout: MazeLayout, x: number, y: number): void
  drawBorder(layout: MazeLayout, nx: number, ny: number): void
  drawWalls(layout: MazeLayout, grid: number[][], nx: number, ny: number): void
  openExit(layout: MazeLayout, nx: number, exitY: number): void
}

/**
 * Вычисляет размеры клеток и начало сетки на canvas.
 *
 * По ширине и высоте резервируется по 20 px; остаток распределяется центрированием.
 * К началу добавляется 0.5 px. Предполагается, что `nx` и `ny` положительны.
 *
 * @param {number} width - Ширина canvas.
 * @param {number} height - Высота canvas.
 * @param {number} nx - Количество столбцов.
 * @param {number} ny - Количество строк.
 * @returns {MazeLayout} Рассчитанная геометрия сетки.
 */
export function computeLayout(width: number, height: number, nx: number, ny: number): MazeLayout {
  const cellWidth = Math.floor((width - 20) / nx)
  const cellHeight = Math.floor((height - 20) / ny)
  const originX = Math.floor((width - nx * cellWidth) / 2) + .5
  const originY = Math.floor((height - ny * cellHeight) / 2) + .5

  return { cellWidth, cellHeight, originX, originY }
}

function gridToX(layout: MazeLayout, n: number): number {
  return layout.originX + n * layout.cellWidth
}

function gridToY(layout: MazeLayout, n: number): number {
  return layout.originY + n * layout.cellHeight
}

/**
 * Создаёт набор функций рисования лабиринта на Canvas 2D.
 *
 * Цвета не передаются рендереру при создании и не хранятся как поля замыкания: каждый вызов draw-метода читает актуальную палитру через `getColors()`.
 * Callback `getColors` разрывает связь с конкретной темой: единственный источник правды — CSS-токены, рендерер лишь спрашивает «что сейчас?».
 *
 * Все методы используют замкнутый `ctx`.
 * Методы не проверяют валидность контекста; предполагается, что `ctx` не `null`.
 *
 * @param {CanvasRenderingContext2D} ctx - 2D-контекст canvas.
 * @param {() => CanvasColors} getColors - Функция, возвращающая текущую палитру Canvas.
 *   Вызывается при каждой отрисовке, поэтому должна отражать актуальные CSS-токены (см. `getCanvasColors` в `src/app/theme.js`).
 * @returns {MazeRenderer} Объект с методами отрисовки.
 * @throws {TypeError} Если `getColors` не является функцией.
 */
export function createRenderer(
  ctx: CanvasRenderingContext2D,
  getColors: () => CanvasColors
): MazeRenderer {
  if (typeof getColors !== 'function') {
    throw new TypeError('createRenderer requires getColors()')
  }

  /**
   * Заливает клетку прямоугольником с отступом 2 px от границ клетки.
   * Используется для игрока и стирания клетки.
   *
   * @param {MazeLayout} layout - Геометрия сетки.
   * @param {number} x - Столбец клетки.
   * @param {number} y - Строка клетки.
   * @param {string} fillColor - Цвет заливки.
   * @param {string} strokeColor - Цвет обводки.
   * @returns {void}
   */
  function fillCell(
    layout: MazeLayout,
    x: number,
    y: number,
    fillColor: string,
    strokeColor: string
  ): void {
    ctx.beginPath()
    ctx.rect(
      gridToX(layout, x) + 2,
      gridToY(layout, y) + 2,
      layout.cellWidth - 4,
      layout.cellHeight - 4
    )
    ctx.fillStyle = fillColor
    ctx.fill()
    ctx.lineWidth = 0
    ctx.strokeStyle = strokeColor
    ctx.stroke()
  }

  /**
   * Заливает внутреннюю часть клетки цветом без отдельной обводки.
   *
   * Прямоугольник меньше, чем у `fillCell`: отступ 5 px от краев клетки, ширина/высота уменьшены на 9 px.
   * Используется для отметок explored/path.
   *
   * Отступ создает «воздух» между заливкой пути и линиями стен, что важно в тёмной теме,
   * где путь и стены имеют разную визуальную природу.
   *
   * @param {MazeLayout} layout - Геометрия сетки.
   * @param {number} x - Столбец клетки.
   * @param {number} y - Строка клетки.
   * @param {string} color - Цвет заливки.
   * @returns {void}
   */
  function paintCell(layout: MazeLayout, x: number, y: number, color: string): void {
    ctx.beginPath()
    ctx.rect(
      gridToX(layout, x) + 5,
      gridToY(layout, y) + 5,
      layout.cellWidth - 9,
      layout.cellHeight - 9
    )
    ctx.fillStyle = color
    ctx.fill()
    ctx.lineWidth = 0
    ctx.strokeStyle = color
    ctx.stroke()
  }

  return {
    /**
     * Очищает всю область canvas.
     *
     * Фон не заливается: canvas прозрачен, и через обёртку `.canvas-wrapper` (её `background: var(--color-surface)`)
     * виден фон страницы. Цвет `--color-canvas-bg` используется только в `eraseCell` и `openExit`:
     * это «цвет стёртой клетки» и «прорезь выхода».
     *
     * @param {number} width - Ширина области.
     * @param {number} height - Высота области.
     * @returns {void}
     */
    clear(width: number, height: number): void {
      ctx.clearRect(0, 0, width, height)
    },

    fillCell,

    /**
     * Стирает клетку, заливая её цветом фона.
     *
     * @param {MazeLayout} layout - Геометрия сетки.
     * @param {number} x - Столбец клетки.
     * @param {number} y - Строка клетки.
     * @returns {void}
     */
    eraseCell(layout: MazeLayout, x: number, y: number): void {
      const { background } = getColors()
      fillCell(layout, x, y, background, background)
    },

    /**
     * Помечает клетку как исследованную (цвет `--color-canvas-explored`).
     *
     * @param {MazeLayout} layout - Геометрия сетки.
     * @param {number} x - Столбец клетки.
     * @param {number} y - Строка клетки.
     * @returns {void}
     */
    markExplored(layout: MazeLayout, x: number, y: number): void {
      paintCell(layout, x, y, getColors().explored)
    },

    /**
     * Помечает клетку как часть найденного пути (цвет `--color-canvas-path`).
     *
     * @param {MazeLayout} layout - Геометрия сетки.
     * @param {number} x - Столбец клетки.
     * @param {number} y - Строка клетки.
     * @returns {void}
     */
    markPath(layout: MazeLayout, x: number, y: number): void {
      paintCell(layout, x, y, getColors().path)
    },

    /**
     * Рисует игрока в клетке.
     *
     * Заливка + обводка; цвета берутся из текущей палитры
     * (`--color-canvas-player-fill` и `--color-canvas-player-stroke`).
     *
     * @param {MazeLayout} layout - Геометрия сетки.
     * @param {number} x - Столбец клетки.
     * @param {number} y - Строка клетки.
     * @returns {void}
     */
    drawPlayer(layout: MazeLayout, x: number, y: number): void {
      const { playerFill, playerStroke } = getColors()
      fillCell(layout, x, y, playerFill, playerStroke)
    },

    /**
     * Рисует внешнюю рамку лабиринта (цвет `--color-canvas-wall`).
     *
     * Толщина линии 2 px для повышения визуального веса стен,
     * чтобы они не терялись на фоне яркого пути в тёмной теме.
     *
     * @param {MazeLayout} layout - Геометрия сетки.
     * @param {number} nx - Количество столбцов.
     * @param {number} ny - Количество строк.
     * @returns {void}
     */
    drawBorder(layout: MazeLayout, nx: number, ny: number): void {
      ctx.beginPath()
      ctx.lineWidth = 2
      ctx.strokeStyle = getColors().wall
      ctx.rect(
        layout.originX,
        layout.originY,
        layout.cellWidth * nx,
        layout.cellHeight * ny
      )
      ctx.stroke()
    },

    /**
     * Рисует верхние и левые стены клеток.
     *
     * Для каждой клетки проверяются только биты `WALL.TOP` и `WALL.LEFT`.
     * Нижние и правые стены визуально совпадают с верхними/левыми стенами соседних клеток,
     * а внешняя граница рисуется отдельно `drawBorder`.
     *
     * Толщина линии 2 px для повышения визуального веса стен.
     *
     * @param {MazeLayout} layout - Геометрия сетки.
     * @param {Array<Array<number>>} grid - Сетка битовых масок стен.
     * @param {number} nx - Количество столбцов.
     * @param {number} ny - Количество строк.
     * @returns {void}
     */
    drawWalls(layout: MazeLayout, grid: number[][], nx: number, ny: number): void {
      ctx.lineWidth = 2
      ctx.strokeStyle = getColors().wall
      for (let x = 0; x < nx; x++) {
        for (let y = 0; y < ny; y++) {
          const cell = grid[x][y]

          if ((cell & WALL.TOP) !== 0) {
            ctx.beginPath()
            ctx.moveTo(gridToX(layout, x), gridToY(layout, y))
            ctx.lineTo(gridToX(layout, x + 1), gridToY(layout, y))
            ctx.stroke()
          }
          if ((cell & WALL.LEFT) !== 0) {
            ctx.beginPath()
            ctx.moveTo(gridToX(layout, x), gridToY(layout, y))
            ctx.lineTo(gridToX(layout, x), gridToY(layout, y + 1))
            ctx.stroke()
          }
        }
      }
    },

    /**
     * Открывает выход, закрашивая участок правой внешней границы цветом фона.
     *
     * Линия рисуется от `(nx, exitY)` до `(nx, exitY + 1)` в координатах сетки.
     * Толщина линии (4 px) и `square`-окончание (`lineCap`) выбраны так, чтобы полностью
     * перекрыть 2 px рамку и визуально разъединить выход с прилегающими горизонтальными
     * стенами клетки, убрав «перемычки» на стыках.
     *
     * @param {MazeLayout} layout - Геометрия сетки.
     * @param {number} nx - Количество столбцов.
     * @param {number} exitY - Строка выхода.
     * @returns {void}
     */
    openExit(layout: MazeLayout, nx: number, exitY: number): void {
      ctx.save()
      ctx.beginPath()
      ctx.lineWidth = 4
      ctx.lineCap = 'square'
      ctx.strokeStyle = getColors().background
      ctx.moveTo(gridToX(layout, nx), gridToY(layout, exitY))
      ctx.lineTo(gridToX(layout, nx), gridToY(layout, exitY + 1))
      ctx.stroke()
      ctx.restore()
    }
  }
}
