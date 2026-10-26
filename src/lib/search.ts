import { WALL } from './constants'

/**
 * Результат поиска пути.
 *
 * @property {boolean} found - Найден ли путь от старта до выхода.
 * @property {Array<{x: number, y: number}>} path - Путь от старта до выхода включительно (содержит и стартовую, и выходную клетки). Пустой массив, если `found === false`.
 */
export interface SolveResult {
  found: boolean
  path: Array<{ x: number, y: number }>
}

/**
 * Входные параметры поиска пути.
 */
export interface SolveMazeInput {
  grid: number[][]
  nx: number
  ny: number
  startX: number
  startY: number
  exitY: number
}

/**
 * Синхронно ищет путь от старта до выхода по сетке битовых масок.
 *
 * Использует BFS с запоминанием родителя; для связного древовидного лабиринта
 * (`generateMaze`) найденный путь единственный, но BFS также корректен при
 * появлении петель. Не работает с DOM/canvas, не запускает таймеров.
 *
 * Выход расположен в последнем столбце (`nx - 1`) на строке `exitY`.
 *
 * @param {SolveMazeInput} input
 * @param {Array<Array<number>>} input.grid - Сетка битовых масок стен (`nx × ny`).
 * @param {number} input.nx - Число столбцов; ожидается положительное целое.
 * @param {number} input.ny - Число строк; ожидается положительное целое.
 * @param {number} input.startX - Столбец старта.
 * @param {number} input.startY - Строка старта.
 * @param {number} input.exitY - Строка выхода.
 * @returns {SolveResult} `{ found, path }`; при недостижимом выходе —
 *   `{ found: false, path: [] }`. Предполагается, что `grid` валиден и
 *   `(startX, startY)` попадает в его границы.
 */
export function solveMaze({
  grid,
  nx,
  ny,
  startX,
  startY,
  exitY
}: SolveMazeInput): SolveResult {
  const exitX = nx - 1

  if (startX === exitX && startY === exitY) {
    return { found: true, path: [{ x: startX, y: startY }] }
  }

  const dist = Array.from({ length: nx }, () => new Array<number>(ny).fill(-1))
  const parent = Array.from({ length: nx }, () => new Array<number[] | null>(ny).fill(null))
  dist[startX][startY] = 0

  const queue: [number, number][] = [[startX, startY]]
  let head = 0
  let reached = false

  while (head < queue.length) {
    const [x, y] = queue[head++]
    const cell = grid[x][y]
    const d = dist[x][y]

    if (y > 0 && (cell & WALL.TOP) === 0 && dist[x][y - 1] === -1) {
      dist[x][y - 1] = d + 1
      parent[x][y - 1] = [x, y]
      if (x === exitX && y - 1 === exitY) { reached = true; break }
      queue.push([x, y - 1])
    }
    if (x > 0 && (cell & WALL.LEFT) === 0 && dist[x - 1][y] === -1) {
      dist[x - 1][y] = d + 1
      parent[x - 1][y] = [x, y]
      if (x - 1 === exitX && y === exitY) { reached = true; break }
      queue.push([x - 1, y])
    }
    if (y < ny - 1 && (cell & WALL.BOTTOM) === 0 && dist[x][y + 1] === -1) {
      dist[x][y + 1] = d + 1
      parent[x][y + 1] = [x, y]
      if (x === exitX && y + 1 === exitY) { reached = true; break }
      queue.push([x, y + 1])
    }
    if (x < nx - 1 && (cell & WALL.RIGHT) === 0 && dist[x + 1][y] === -1) {
      dist[x + 1][y] = d + 1
      parent[x + 1][y] = [x, y]
      if (x + 1 === exitX && y === exitY) { reached = true; break }
      queue.push([x + 1, y])
    }
  }

  if (!reached) return { found: false, path: [] }

  const path: Array<{ x: number, y: number }> = []
  let cx = exitX
  let cy = exitY
  while (cx !== startX || cy !== startY) {
    path.push({ x: cx, y: cy })
    const [px, py] = parent[cx][cy]!
    cx = px
    cy = py
  }
  path.push({ x: startX, y: startY })
  path.reverse()

  return { found: true, path }
}
