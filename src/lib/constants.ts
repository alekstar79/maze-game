/**
 * Битовая маска стен клетки лабиринта.
 *
 * Значения используются как биты в числе клетки: `TOP`, `LEFT`, `BOTTOM`, `RIGHT`.
 *
 * @constant
 * @type {Readonly<{TOP: 1, LEFT: 2, BOTTOM: 4, RIGHT: 8}>}
 */
export const WALL = {
  TOP: 1,
  LEFT: 2,
  BOTTOM: 4,
  RIGHT: 8
} as const

/**
 * Маска всех четырёх стен.
 *
 * Равна побитовому OR значений `WALL.TOP`, `WALL.LEFT`, `WALL.BOTTOM`, `WALL.RIGHT`;
 * используется для полностью закрытой клетки.
 *
 * @constant
 * @type {number}
 */
export const FULL_WALL: number =
  WALL.TOP | WALL.LEFT | WALL.BOTTOM | WALL.RIGHT

/**
 * Допустимые границы размеров лабиринта.
 *
 * `minColumns`/`minRows` и `maxColumns`/`maxRows` применяются при сбросе игры через `clamp`.
 *
 * @constant
 * @type {Readonly<{minColumns: 3, minRows: 3, maxColumns: 111, maxRows: 80}>}
 */
export const LIMITS = {
  minColumns: 3,
  minRows: 3,
  maxColumns: 111,
  maxRows: 80
} as const

/**
 * Режимы таймера.
 *
 * - `'demo'` — отсчёт вверх без ограничения; автопоиск разрешён.
 * - `'timed'` — обратный отсчёт до лимита; автопоиск запрещён.
 *
 * @constant
 * @type {Readonly<{DEMO: 'demo', TIMED: 'timed'}>}
 */
export const MODE = {
  DEMO: 'demo',
  TIMED: 'timed'
} as const

export type Mode = (typeof MODE)[keyof typeof MODE]

/**
 * Уровни сложности. Влияют на расчёт лимита времени в режиме `'timed'`.
 *
 * @constant
 * @type {Readonly<{EASY: 'easy', MEDIUM: 'medium', HARD: 'hard'}>}
 */
export const DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard'
} as const

export type Difficulty = (typeof DIFFICULTY)[keyof typeof DIFFICULTY]

/**
 * Параметры эмпирического расчёта лимита времени (Timed).
 *
 * Лабиринт виден целиком, поэтому «исследование» тупиков у игрока
 * минимально: он планирует маршрут взглядом, а не ходит вслепую.
 * `stepTimeMs` — базовая стоимость одной клетки пути (взгляд → нажатие → шаг)
 * `exploreFraction` — небольшая поправка на случайные неверные ходы в полностью видимом лабиринте
 * `difficultyFactor` — множители по сложности
 * Значения откалиброваны как ~2× строже предыдущей версии (ASM-011).
 *
 * @constant
 * @type {Readonly<{stepTimeMs: 1000, exploreFraction: 0.08, minTimeLimitMs: 5000, difficultyFactor: Readonly<{easy: 0.9, medium: 0.6, hard: 0.4}>}>}
 */
export const TIMING = {
  stepTimeMs: 1000, // 1700
  exploreFraction: .08, // .3
  minTimeLimitMs: 5000,
  difficultyFactor: {
    easy: .9, // 1.5
    medium: .6,
    hard: .4 // .7
  } as const
} as const

/**
 * Ключи хранилищ.
 * Версия в суффиксе допускает миграцию структуры без конфликта со старой.
 *
 * @constant
 * @type {Readonly<{currentUser: 'maze.currentUser', gridSizes: 'maze.gridSizes.v1', stats: 'maze.stats.v1'}>}
 */
export const STORAGE_KEYS = {
  currentUser: 'maze.currentUser',
  gridSizes: 'maze.gridSizes.v1',
  stats: 'maze.stats.v1'
} as const

/**
 * Имя, под которым сохраняется статистика неаутентифицированного игрока.
 *
 * @constant
 * @type {'гость'}
 */
export const GUEST_NAME = 'гость'
