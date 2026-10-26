import type { Mode } from './constants'

/**
 * Интервал обновления таймера, мс. Выбран так, чтобы UI оставался
 * живым, но не дёргал браузер слишком часто.
 *
 * @constant
 * @type {number}
 */
const TICK_INTERVAL_MS = 200

/**
 * Снимок состояния таймера, передаваемый в `onTick`.
 *
 * @property {'demo'|'timed'} mode - Режим таймера.
 * @property {number} elapsedMs - Прошедшее (непрерывное) время, мс.
 * @property {number|null} remainingMs - Остаток для `'timed'`, иначе `null`.
 */
export interface TimerTick {
  mode: Mode
  elapsedMs: number
  remainingMs: number | null
}

/**
 * Параметры запуска таймера.
 */
export interface TimerStartOptions {
  mode?: Mode
  limitMs?: number
}

/**
 * Хуки таймера.
 */
export interface TimerHooks {
  onTick?: (tick: TimerTick) => void
  onExpire?: () => void
}

/**
 * API таймера.
 */
export interface MazeTimer {
  start(opts?: TimerStartOptions): void
  stop(): void
  pause(): void
  resume(): void
  getElapsed(): number
  isRunning(): boolean
}

/**
 * Создаёт таймер с двумя режимами: `demo` (отсчёт вверх) и `timed`
 * (отсчёт вниз до `limitMs`).
 *
 * В режиме `timed` по достижении лимита вызывает `onExpire()` и
 * останавливается. Паузы (например, из-за `visibilitychange`) не
 * учитываются в эффективном времени. Интервал снимается при `pause`,
 * а не «замораживается» — это исключает бесполезный колбэк в фоне.
 *
 * @param {TimerHooks} [hooks]
 * @param {(tick: TimerTick) => void} [hooks.onTick]
 * @param {() => void} [hooks.onExpire]
 * @returns {MazeTimer}
 */
export function createTimer({ onTick, onExpire }: TimerHooks = {}): MazeTimer {
  let mode: Mode = 'demo'
  let limitMs = 0
  let elapsedMs = 0
  let lastResumeAt = 0
  let running = false
  let started = false
  let intervalId: ReturnType<typeof setInterval> | null = null

  function flushPause(): void {
    if (!running) return

    elapsedMs += performance.now() - lastResumeAt
    running = false
  }

  function getElapsed(): number {
    return running ? elapsedMs + (performance.now() - lastResumeAt) : elapsedMs
  }

  function tick(): void {
    const elapsed = getElapsed()
    const remaining = mode === 'timed' ? Math.max(0, limitMs - elapsed) : null

    if (mode === 'timed' && elapsed >= limitMs) {
      if (onTick) {
        onTick({ mode, elapsedMs: elapsed, remainingMs: 0 })
      }

      flushPause()

      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }

      started = false
      if (onExpire) onExpire()
      return
    }

    if (onTick) {
      onTick({ mode, elapsedMs: elapsed, remainingMs: remaining })
    }
  }

  /**
   * Запускает таймер с нуля. Повторный вызов перезапускает.
   *
   * @param {TimerStartOptions} [opts]
   * @returns {void}
   */
  function start({
    mode: m = 'demo',
    limitMs: lim = 0
  }: TimerStartOptions = {}): void {
    stop()
    mode = m
    limitMs = lim
    elapsedMs = 0
    running = true
    started = true
    lastResumeAt = performance.now()
    intervalId = setInterval(tick, TICK_INTERVAL_MS)
    tick()
  }

  /**
   * Останавливает таймер; повторный запуск обнуляет счётчики.
   *
   * @returns {void}
   */
  function stop(): void {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }

    flushPause()
    started = false
  }

  /**
   * Приостанавливает отсчёт. Если таймер не запущен — no-op.
   *
   * @returns {void}
   */
  function pause(): void {
    if (!running) return

    flushPause()

    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  /**
   * Возобновляет отсчёт после `pause()`. Если таймер уже идёт — no-op.
   *
   * @returns {void}
   */
  function resume(): void {
    if (running || !started) return

    lastResumeAt = performance.now()
    running = true
    intervalId = setInterval(tick, TICK_INTERVAL_MS)

    tick()
  }

  /**
   * @returns {boolean} `true`, если таймер запущен (включая паузу).
   */
  function isRunning(): boolean {
    return started
  }

  return {
    start,
    stop,
    pause,
    resume,
    getElapsed,
    isRunning
  }
}
