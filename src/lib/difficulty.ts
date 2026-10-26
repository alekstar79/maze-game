import { TIMING } from './constants'

/**
 * Входные параметры расчёта лимита времени.
 */
export interface ComputeTimeLimitInput {
  nx: number
  ny: number
  solutionLength: number
  difficulty: string
}

/**
 * Рассчитывает лимит времени (Timed) по длине пути, размеру сетки
 * и уровню сложности.
 *
 * Модель:
 *  - `pathMs = solutionLength * stepTimeMs` — время прохождения пути;
 *  - `exploreMs = (nx*ny - solutionLength) * stepTimeMs * exploreFraction`
 *    — поправка на исследование тупиковых ветвей;
 *  - `baseMs = pathMs + exploreMs`;
 *  - `limitMs = max(minTimeLimitMs, round(baseMs * difficultyFactor))`.
 *
 * Формула — эмпирическая: она опирается на среднюю скорость принятия
 * решений игроком, а не на «идеального» проходчика. Значения
 * коэффициентов — в `TIMING` (см. ASM-011).
 *
 * @param {ComputeTimeLimitInput} input
 * @param {number} input.nx - Число столбцов.
 * @param {number} input.ny - Число строк.
 * @param {number} input.solutionLength - Длина пути
 *   (из `measureSolutionLength`); отрицательное значение трактуется как 1.
 * @param {string} input.difficulty - `'easy' | 'medium' | 'hard'`.
 * @returns {number} Лимит времени в миллисекундах (≥ `minTimeLimitMs`).
 */
export function computeTimeLimit({
  nx,
  ny,
  solutionLength,
  difficulty
}: ComputeTimeLimitInput): number {
  const factor = (TIMING.difficultyFactor as Readonly<Record<string, number>>)[difficulty] ?? 1.0
  const pathMs = Math.max(1, solutionLength) * TIMING.stepTimeMs
  const deadEndCells = Math.max(0, nx * ny - solutionLength - 1)
  const exploreMs = deadEndCells * TIMING.stepTimeMs * TIMING.exploreFraction

  return Math.max(
    TIMING.minTimeLimitMs,
    Math.round((pathMs + exploreMs) * factor)
  )
}
