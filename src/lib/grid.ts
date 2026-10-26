import { WALL, FULL_WALL } from './constants'

/**
 * Один из четырёх битов направления стены.
 */
type WallDirection = (typeof WALL)[keyof typeof WALL]

/**
 * Создаёт сетку, в каждой клетке которой установлены все четыре стены.
 *
 * @param {number} nx - Число столбцов.
 * @param {number} ny - Число строк.
 * @returns {Array<Array<number>>} Сетка `nx × ny` со значениями `FULL_WALL`.
 */
export function createFullGrid(nx: number, ny: number): number[][] {
  return Array.from({ length: nx }, () => new Array<number>(ny).fill(FULL_WALL))
}

/**
 * Убирает общую стену между текущей клеткой и соседней.
 *
 * Снимает бит стены у текущей клетки и противоположный бит у соседней.
 * Предполагается, что соседняя клетка существует.
 *
 * @param {Array<Array<number>>} grid - Сетка битовых масок стен.
 * @param {number} x - Столбец текущей клетки.
 * @param {number} y - Строка текущей клетки.
 * @param {number} direction - Один из `WALL.TOP`, `WALL.LEFT`, `WALL.BOTTOM`, `WALL.RIGHT`.
 * @returns {void}
 * @throws {TypeError} Если направление указывает за границу сетки.
 */
function openSharedWall(
  grid: number[][],
  x: number,
  y: number,
  direction: WallDirection
): void {
  switch (direction) {
    case WALL.TOP:
      grid[x][y] &= ~WALL.TOP
      grid[x][y - 1] &= ~WALL.BOTTOM
      break
    case WALL.LEFT:
      grid[x][y] &= ~WALL.LEFT
      grid[x - 1][y] &= ~WALL.RIGHT
      break
    case WALL.BOTTOM:
      grid[x][y] &= ~WALL.BOTTOM
      grid[x][y + 1] &= ~WALL.TOP
      break
    case WALL.RIGHT:
      grid[x][y] &= ~WALL.RIGHT
      grid[x + 1][y] &= ~WALL.LEFT
      break
  }
}

function nextCell(
  x: number,
  y: number,
  direction: WallDirection
): { x: number; y: number } {
  switch (direction) {
    case WALL.TOP: return { x, y: y - 1 }
    case WALL.LEFT: return { x: x - 1, y }
    case WALL.BOTTOM: return { x, y: y + 1 }
    case WALL.RIGHT: return { x: x + 1, y }
  }
}

/**
 * Собирает битовую маску направлений на непосещённые соседние клетки.
 *
 * Направление попадает в маску, если сосед существует, текущая клетка
 * имеет стену в этом направлении, а соседняя клетка всё ещё равна
 * `FULL_WALL` (не посещена).
 *
 * @param {Array<Array<number>>} grid - Сетка битовых масок стен.
 * @param {number} nx - Число столбцов.
 * @param {number} ny - Число строк.
 * @param {number} x - Столбец текущей клетки.
 * @param {number} y - Строка текущей клетки.
 * @returns {number} Битовая маска из `WALL.*`; 0, если доступных соседей нет.
 */
function collectUnvisitedNeighbours(
  grid: number[][],
  nx: number,
  ny: number,
  x: number,
  y: number
): number {
  const cell = grid[x][y]
  let mask = 0

  if (y > 0 && (cell & WALL.TOP) !== 0 && grid[x][y - 1] === FULL_WALL) {
    mask |= WALL.TOP
  }
  if (x > 0 && (cell & WALL.LEFT) !== 0 && grid[x - 1][y] === FULL_WALL) {
    mask |= WALL.LEFT
  }
  if (y < ny - 1 && (cell & WALL.BOTTOM) !== 0 && grid[x][y + 1] === FULL_WALL) {
    mask |= WALL.BOTTOM
  }
  if (x < nx - 1 && (cell & WALL.RIGHT) !== 0 && grid[x + 1][y] === FULL_WALL) {
    mask |= WALL.RIGHT
  }

  return mask
}

/**
 * Случайно выбирает одно из направлений, присутствующих в маске.
 *
 * Порядок перебора: TOP, LEFT, BOTTOM, RIGHT. Функция предполагает, что
 * `mask !== 0`; при нулевой маске цикл не завершится.
 *
 * [RISK K-001: при `mask === 0` возможен бесконечный цикл; вызывающий
 * `generateMaze` гарантирует ненулевую маску.]
 *
 * @param {number} mask - Битовая маска доступных направлений.
 * @returns {WallDirection} Один бит из `WALL.*`.
 */
function pickDirection(mask: number): WallDirection {
  const order: WallDirection[] = [WALL.TOP, WALL.LEFT, WALL.BOTTOM, WALL.RIGHT]
  let direction: WallDirection | null = null

  while (direction === null) {
    const candidate = order[Math.floor(Math.random() * 4)]
    if ((candidate & mask) !== 0) {
      direction = candidate
    }
  }

  return direction
}

/**
 * Случайно выбирает уже посещённую клетку.
 *
 * Посещённой считается клетка, значение которой не равно `FULL_WALL`.
 * Предполагается, что хотя бы одна такая клетка существует.
 *
 * [RISK K-001: при отсутствии посещённых клеток возможен бесконечный цикл;
 * предусловие обеспечивается алгоритмом `generateMaze`.]
 *
 * @param {Array<Array<number>>} grid - Сетка битовых масок стен.
 * @param {number} nx - Число столбцов.
 * @param {number} ny - Число строк.
 * @returns {{x: number, y: number}} Координаты посещённой клетки.
 */
function pickVisitedCell(
  grid: number[][],
  nx: number,
  ny: number
): { x: number; y: number } {
  let x: number, y: number

  do {
    x = Math.floor(Math.random() * nx)
    y = Math.floor(Math.random() * ny)
  } while (grid[x][y] === FULL_WALL)

  return { x, y }
}

/**
 * Генерирует лабиринт итеративным алгоритмом роста из случайной клетки.
 *
 * Начинает с полностью закрытой сетки. На каждом шаге открывает стену к случайному непосещённому соседу и переходит в него.
 * Если у текущей клетки нет непосещённых соседей, выбирает случайную уже посещённую клетку и продолжает от неё.
 * После `nx * ny - 1` открытий все клетки посещены, а сетка образует связное дерево.
 *
 * @param {number} nx - Число столбцов; ожидается положительное целое.
 * @param {number} ny - Число строк; ожидается положительное целое.
 * @returns {Array<Array<number>>} Сетка битовых масок стен.
 */
export function generateMaze(nx: number, ny: number): number[][] {
  const grid = createFullGrid(nx, ny)

  let remainingWalls = nx * ny - 1
  let cellX = Math.floor(Math.random() * nx)
  let cellY = Math.floor(Math.random() * ny)

  while (remainingWalls > 0) {
    const neighbours = collectUnvisitedNeighbours(grid, nx, ny, cellX, cellY)

    if (neighbours === 0) {
      const restart = pickVisitedCell(grid, nx, ny)
      cellX = restart.x
      cellY = restart.y
      continue
    }

    const direction = pickDirection(neighbours)
    openSharedWall(grid, cellX, cellY, direction)

    const next = nextCell(cellX, cellY, direction)
    cellX = next.x
    cellY = next.y

    remainingWalls--
  }

  return grid
}

/**
 * Измеряет длину единственного пути от старта до выхода (в шагах).
 *
 * Использует BFS по сетке; в силу древовидности лабиринта найденный путь единственный и совпадает с кратчайшим.
 * Возвращает `-1`, если выход недостижим (для корректных лабиринтов не встречается; проверка нужна для страховки от повреждённой сетки).
 *
 * @param {Array<Array<number>>} grid - Сетка битовых масок.
 * @param {number} nx - Число столбцов.
 * @param {number} ny - Число строк.
 * @param {number} startX - Столбец старта.
 * @param {number} startY - Строка старта.
 * @param {number} exitX - Столбец выхода.
 * @param {number} exitY - Строка выхода.
 * @returns {number} Длина пути (число переходов) или `-1`.
 */
export function measureSolutionLength(
  grid: number[][],
  nx: number,
  ny: number,
  startX: number,
  startY: number,
  exitX: number,
  exitY: number
): number {
  if (startX === exitX && startY === exitY) return 0

  const dist = Array.from({ length: nx }, () => new Array<number>(ny).fill(-1))
  dist[startX][startY] = 0

  const queue: [number, number][] = [[startX, startY]]
  let head = 0

  while (head < queue.length) {
    const [x, y] = queue[head++]
    const cell = grid[x][y]
    const d = dist[x][y]

    if (y > 0 && (cell & WALL.TOP) === 0 && dist[x][y - 1] === -1) {
      dist[x][y - 1] = d + 1
      if (x === exitX && y - 1 === exitY) return d + 1
      queue.push([x, y - 1])
    }
    if (x > 0 && (cell & WALL.LEFT) === 0 && dist[x - 1][y] === -1) {
      dist[x - 1][y] = d + 1
      if (x - 1 === exitX && y === exitY) return d + 1
      queue.push([x - 1, y])
    }
    if (y < ny - 1 && (cell & WALL.BOTTOM) === 0 && dist[x][y + 1] === -1) {
      dist[x][y + 1] = d + 1
      if (x === exitX && y + 1 === exitY) return d + 1
      queue.push([x, y + 1])
    }
    if (x < nx - 1 && (cell & WALL.RIGHT) === 0 && dist[x + 1][y] === -1) {
      dist[x + 1][y] = d + 1
      if (x + 1 === exitX && y === exitY) return d + 1
      queue.push([x + 1, y])
    }
  }

  return -1
}
