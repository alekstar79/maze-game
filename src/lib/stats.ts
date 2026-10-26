import { STORAGE_KEYS, GUEST_NAME, DIFFICULTY, MODE, type Difficulty } from './constants'

/**
 * Статистика одного игрока.
 *
 * @property {number} games - Число завершённых игр.
 * @property {number} totalTimeMs - Суммарное время завершённых игр, мс.
 * @property {{easy: Record<string, number|null>, medium: Record<string, number|null>, hard: Record<string, number|null>}} best - Лучшее время для каждой пары (difficulty, mode).
 */
export interface PlayerStats {
  games: number
  totalTimeMs: number
  best: {
    easy: Record<string, number | null>
    medium: Record<string, number | null>
    hard: Record<string, number | null>
  }
}

/**
 * Параметры записи победы.
 */
export interface RecordWinInput {
  difficulty: string
  mode: string
  elapsedMs: number
}

/**
 * Внутренняя форма хранилища статистики.
 */
interface StorageData {
  players: Record<string, PlayerStats>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStorageData(value: unknown): value is StorageData {
  return isRecord(value) && isRecord(value.players)
}

function isDifficulty(value: string): value is Difficulty {
  return value === DIFFICULTY.EASY
    || value === DIFFICULTY.MEDIUM
    || value === DIFFICULTY.HARD
}

/**
 * Читает всё хранилище статистики. Битые/отсутствующие данные
 * трактуются как «пустое хранилище» — без исключений наружу.
 *
 * @returns {{players: Record<string, PlayerStats>}}
 */
function readAll(): StorageData {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.stats)
    if (!raw) {
      return { players: {} }
    }

    const parsed: unknown = JSON.parse(raw)
    if (!isStorageData(parsed)) {
      return { players: {} }
    }

    return parsed
  } catch {
    return { players: {} }
  }
}

function writeAll(data: StorageData): void {
  try {
    localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(data))
  } catch {/* quota exceeded — молча игнорируем (RSK-003) */}
}

/**
 * Возвращает «пустую» структуру статистики игрока с корректным набором
 * ключей `best` для всех пар (difficulty, mode).
 *
 * @returns {PlayerStats}
 */
function emptyPlayer(): PlayerStats {
  return {
    games: 0,
    totalTimeMs: 0,
    best: {
      [DIFFICULTY.EASY]:   { [MODE.DEMO]: null, [MODE.TIMED]: null },
      [DIFFICULTY.MEDIUM]: { [MODE.DEMO]: null, [MODE.TIMED]: null },
      [DIFFICULTY.HARD]:   { [MODE.DEMO]: null, [MODE.TIMED]: null },
    }
  }
}

function normalizeName(name: string): string {
  const trimmed = typeof name === 'string' ? name.trim() : ''
  return trimmed || GUEST_NAME
}

/**
 * Возвращает статистику игрока (или пустую, если такого ещё нет).
 * Пустое имя трактуется как `GUEST_NAME`.
 *
 * @param {string} name - Имя; пустое → `«гость»`.
 * @returns {PlayerStats}
 */
export function getPlayer(name: string): PlayerStats {
  const key = normalizeName(name)
  return readAll().players[key] ?? emptyPlayer()
}

/**
 * Записывает победу: +1 игра, += `elapsedMs`, обновляет лучшее время
 * для пары (difficulty, mode), если оно лучше или его нет.
 *
 * @param {string} name - Имя; пустое → `«гость»`.
 * @param {{ difficulty: string, mode: string, elapsedMs: number }} record
 * @returns {PlayerStats} Обновлённая статистика.
 */
export function recordWin(
  name: string,
  { difficulty, mode, elapsedMs }: RecordWinInput
): PlayerStats {
  const key = normalizeName(name)
  const all = readAll()

  if (!all.players[key]) {
    all.players[key] = emptyPlayer()
  }

  const p = all.players[key]

  p.games += 1
  p.totalTimeMs += elapsedMs

  if (isDifficulty(difficulty)) {
    const cell = p.best[difficulty]
    const slot = cell[mode]
    if (typeof slot !== 'number' || elapsedMs < slot) {
      cell[mode] = elapsedMs
    }
  }

  writeAll(all)
  return p
}
