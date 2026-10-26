/**
 * Точка входа браузерной игры.
 *
 * Связывает DOM с фабрикой игры, таймером, статистикой и аккаунтом.
 * Управляет состояниями UI: до `Start` — лабиринт виден, но ходы не обрабатываются;
 * во время игры — активны перемещения, в Demo, автопоиск;
 * по завершении — управление отключается.
 *
 * При загрузке инициализирует локаль и тему до создания игры, чтобы первый draw шёл с актуальной палитрой и переведёнными строками.
 * Связывает переключатели `#theme-select` и `#locale-select` с модулями `src/app/theme.js` и `src/app/i18n.js`.
 * При смене темы перерисовывает сцену (`game.redraw()`), сохраняя состояние игры.
 * При смене локали перерисовывает динамические строки (статус, статистику, имя игрока).
 */
import { useMazeGame, type StartInfo } from './app/game'
import { createTimer, type TimerTick } from './lib/timer'
import { computeTimeLimit } from './lib/difficulty'
import { getPlayer, recordWin } from './lib/stats'
import { login, logout, getCurrentUser } from './lib/auth'
import {
  MODE,
  DIFFICULTY,
  GUEST_NAME,
  LIMITS,
  STORAGE_KEYS,
  type Mode,
  type Difficulty
} from './lib/constants'
import {
  initI18n,
  getLocale,
  setLocale,
  t,
  applyTranslations,
  formatNumber,
  formatDuration
} from './app/i18n'
import {
  initTheme,
  getThemePreference,
  setThemePreference,
  getCanvasColors
} from './app/theme'

/** Порог «мало времени»: доля остатка от исходного лимита. */
const URGENT_RATIO = 0.2

/** Статус-«модификатор»: `'success'`, `'error'` или `null` (нет модификатора). */
type StatusKind = 'success' | 'error' | null

/**
 * Последний установленный статус — для перерисовки при смене языка.
 */
interface LastStatus {
  key: string | null
  params: Record<string, string>
  kind: StatusKind
}

/**
 * Сохранённый размер лабиринта пользователя.
 */
interface GridSize {
  nx: number
  ny: number
}

/**
 * Снимает фокус с `select`/`input`, если он там оказался.
 *
 * Предотвращает ситуацию, когда после клика по `<select>` в HUD фокус остаётся на нём,
 * и последующие нажатия стрелок меняют значение селекта (тему, язык, размер лабиринта) вместо того,
 * чтобы двигать игрока.
 *
 * @returns {void}
 */
function blurFormControl(): void {
  const active = document.activeElement
  if (!active) return
  if (active === document.body) return
  if (!(active instanceof HTMLElement)) return
  if (active.tagName === 'SELECT' || active.tagName === 'INPUT') {
    active.blur()
  }
}

/**
 * Проверяет, что значение — объект-запись (не массив, не null).
 *
 * @param {unknown} value - Проверяемое значение.
 * @returns {boolean} `true`, если значение — `Record<string, unknown>`.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Возвращает элемент по id с проверкой типа.
 *
 * @param {string} id - Идентификатор элемента в DOM.
 * @param {{new(): T}} ctor - Ожидаемый конструктор элемента.
 * @returns {T} Найденный элемент.
 * @throws {Error} Если элемент не найден или имеет другой тип.
 */
function mustGetElement<T extends HTMLElement>(
  id: string,
  ctor: { new(): T }
): T {
  const el = document.getElementById(id)
  if (!(el instanceof ctor)) {
    throw new Error(`Element #${id} not found or has unexpected type`)
  }
  return el
}

/**
 * Парсит режим из значения `<select>`.
 *
 * @param {string} value - Сырое значение.
 * @returns {Mode} Нормализованный режим.
 */
function parseMode(value: string): Mode {
  return value === MODE.TIMED ? MODE.TIMED : MODE.DEMO
}

/**
 * Парсит сложность из значения `<select>`.
 *
 * @param {string} value - Сырое значение.
 * @returns {Difficulty} Нормализованная сложность.
 */
function parseDifficulty(value: string): Difficulty {
  if (value === DIFFICULTY.EASY) return DIFFICULTY.EASY
  if (value === DIFFICULTY.HARD) return DIFFICULTY.HARD
  return DIFFICULTY.MEDIUM
}

window.addEventListener('load', () => {
  /** Canvas, на котором рисуется лабиринт. */
  const canvas = mustGetElement('mazeCanvas', HTMLCanvasElement)
  /** Форма управления размером лабиринта. */
  const form = mustGetElement('controls', HTMLFormElement)
  /** Поле числа столбцов. */
  const nxInput = mustGetElement('nx', HTMLInputElement)
  /** Поле числа строк. */
  const nyInput = mustGetElement('ny', HTMLInputElement)

  /** Выбор режима таймера. */
  const modeSelect = mustGetElement('mode', HTMLSelectElement)
  /** Выбор сложности. */
  const difficultySelect = mustGetElement('difficulty', HTMLSelectElement)
  /** Кнопка запуска игры. */
  const startBtn = mustGetElement('start', HTMLButtonElement)
  /** Кнопка автопоиска. */
  const autosearchBtn = mustGetElement('autosearch', HTMLButtonElement)

  /** Индикатор времени (обёртка; на ней — состояние `is-urgent`). */
  const timerBar = mustGetElement('timer-bar', HTMLElement)
  /** Числовое значение таймера (внутри `#timer-bar`, чтобы не затирать
   *  `visually-hidden` ярлык «Time remaining:»). */
  const timerValue = mustGetElement('timer-value', HTMLElement)
  /** Строка статуса. */
  const statusEl = mustGetElement('status', HTMLElement)

  /** Текущий игрок (отображаемое имя). */
  const playerEl = mustGetElement('current-player', HTMLElement)
  /** Кнопка «Войти». */
  const loginBtn = mustGetElement('login', HTMLButtonElement)
  /** Кнопка «Выйти». */
  const logoutBtn = mustGetElement('logout', HTMLButtonElement)

  /** Модалка входа. */
  const loginDialog = mustGetElement('login-dialog', HTMLDialogElement)
  /** Поле имени в модалке. */
  const loginNameInput = mustGetElement('login-name', HTMLInputElement)
  /** Кнопка отмены в модалке. */
  const loginCancelBtn = mustGetElement('login-cancel', HTMLButtonElement)

  /** Блок статистики. */
  const statsEl = mustGetElement('stats', HTMLElement)

  /** Выбор темы: `system` / `light` / `dark`. */
  const themeSelect = mustGetElement('theme-select', HTMLSelectElement)
  /** Выбор языка: `en` / `ru`. */
  const localeSelect = mustGetElement('locale-select', HTMLSelectElement)

  let currentMode: Mode = parseMode(modeSelect.value)
  let currentDifficulty: Difficulty = parseDifficulty(difficultySelect.value)
  let currentLimitMs = 0

  /**
   * Последний установленный статус — для перерисовки при смене языка.
   *
   * Хранит ключ, параметры и kind (success/error/null), чтобы `renderStatus()`
   * мог восстановить строку через `t()` без знания о том, кто её вызвал.
   * `params` для `status.initial` содержит `{ name: ... }` и должен быть
   * обновлён при смене локали (display-name гостя локализуется).
   */
  let lastStatus: LastStatus = { key: null, params: {}, kind: null }

  // ---- i18n + theme init (до создания игры, чтобы первый draw был корректным) ----

  initI18n()
  applyTranslations()

  initTheme()

  themeSelect.value = getThemePreference()
  localeSelect.value = getLocale()

  const game = useMazeGame(canvas, {
    width: 800,
    height: 500,
    columns: 10,
    rows: 8,
    getColors: getCanvasColors,
    onStart: handleStart,
    onWin: handleWin
  })

  const timer = createTimer({
    onTick: renderTimer,
    onExpire: handleTimeout
  })

  // ---- Timer / visibility ----

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) timer.pause()
    else timer.resume()
  })

  // ---- Game callbacks ----

  function handleStart({ nx, ny, solutionLength }: StartInfo): void {
    // Снимаем фокус с любого select/input, если он туда попал до старта:
    // иначе стрелки будут менять значение контрола вместо перемещения игрока.
    blurFormControl()

    if (currentMode === MODE.TIMED) {
      currentLimitMs = computeTimeLimit({
        nx,
        ny,
        solutionLength,
        difficulty: currentDifficulty
      })
      timer.start({ mode: MODE.TIMED, limitMs: currentLimitMs })
    } else {
      currentLimitMs = 0
      timer.start({ mode: MODE.DEMO })
    }
    setStatus('')
    timerBar.classList.remove('is-urgent')
    updateControls()
  }

  function handleWin(): void {
    const elapsed = timer.getElapsed()
    timer.stop()

    recordWin(getCurrentUser() ?? GUEST_NAME, {
      difficulty: currentDifficulty,
      mode: currentMode,
      elapsedMs: elapsed
    })

    setStatus('status.win', { time: formatDuration(elapsed) }, 'success')
    timerValue.textContent = formatDuration(elapsed)
    timerBar.classList.remove('is-urgent')
    renderStats()
    updateControls()
  }

  function handleTimeout(): void {
    if (game.state.phase !== 'playing') return
    game.endGame()
    setStatus('status.timeout', {}, 'error')
    timerValue.textContent = formatDuration(0)
    timerBar.classList.remove('is-urgent')
    updateControls()
  }

  // ---- Timer UI ----

  function renderTimer({ mode, elapsedMs, remainingMs }: TimerTick): void {
    if (mode === MODE.TIMED) {
      const remaining = Math.max(0, remainingMs ?? 0)
      timerValue.textContent = formatDuration(remaining)
      const urgent =
        currentLimitMs > 0 && remaining <= currentLimitMs * URGENT_RATIO
      timerBar.classList.toggle('is-urgent', urgent)
    } else {
      timerValue.textContent = formatDuration(elapsedMs)
      timerBar.classList.remove('is-urgent')
    }
  }

  /**
   * Устанавливает строку статуса через i18n-ключ.
   *
   * Сохраняет `{key, params, kind}` в `lastStatus`, чтобы `renderStatus()`
   * мог восстановить строку при смене языка без участия вызывающего кода.
   *
   * @param {string} key - Ключ перевода (например, `'status.win'`); пустая строка означает «очистить статус».
   * @param {Record<string, string>} [params] - Параметры для `t()`.
   * @param {string|null} [kind] - `'success'` | `'error'` | `null` — модификатор CSS-класса `.status-<kind>`.
   * @returns {void}
   */
  function setStatus(
    key: string,
    params: Record<string, string> = {},
    kind: StatusKind = null
  ): void {
    lastStatus = { key, params, kind }
    renderStatus()
  }

  /**
   * Перерисовывает видимую строку статуса из `lastStatus`.
   *
   * Вызывается из `setStatus()` и при смене языка (после `applyTranslations()`),
   * чтобы текст соответствовал активной локали.
   *
   * @returns {void}
   */
  function renderStatus(): void {
    if (!lastStatus.key) {
      statusEl.textContent = ''
      statusEl.className = 'status'
      return
    }

    statusEl.textContent = t(lastStatus.key, lastStatus.params)
    statusEl.className = lastStatus.kind
      ? `status status-${lastStatus.kind}`
      : 'status'
  }

  /**
   * Устанавливает начальный статус, используя имя текущего пользователя.
   *
   * @returns {void}
   */
  function renderInitialStatus(): void {
    const user = getCurrentUser()
    setStatus('status.initial', { name: user ?? t('player.guest') })
  }

  // ---- Controls state ----

  function updateControls(): void {
    const playing = game.state.phase === 'playing'
    modeSelect.disabled = playing
    difficultySelect.disabled = playing
    // Автопоиск разрешён только в Demo и только во время игры.
    autosearchBtn.disabled = !playing || currentMode !== MODE.DEMO
  }

  /**
   * Читает сохранённые размеры лабиринта для указанного пользователя.
   *
   * Данные хранятся в `localStorage[STORAGE_KEYS.gridSizes]` как объект
   * «имя пользователя → { nx, ny }». Отсутствие записи или повреждённые
   * данные трактуются как отсутствие сохранённых размеров.
   *
   * @param {string} user - Имя пользователя или `GUEST_NAME`.
   * @returns {{nx: number, ny: number}|null} Размеры или `null`, если их нет.
   */
  function getSavedGridSize(user: string): GridSize | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.gridSizes)
      if (!raw) return null
      const parsed: unknown = JSON.parse(raw)
      if (!isRecord(parsed)) return null
      const entry = parsed[user]
      if (!isRecord(entry)) return null
      const nx = Number(entry.nx)
      const ny = Number(entry.ny)
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null
      return { nx, ny }
    } catch {
      return null
    }
  }

  /**
   * Сохраняет размеры лабиринта для указанного пользователя.
   *
   * Значения должны быть предварительно проверены на соответствие `LIMITS`.
   * Ошибки записи (например, переполнение квоты) игнорируются: сохранение
   * размеров — вспомогательная функция, её сбой не должен ломать игру.
   *
   * @param {string} user - Имя пользователя или `GUEST_NAME`.
   * @param {number} nx - Число столбцов.
   * @param {number} ny - Число строк.
   * @returns {void}
   */
  function saveGridSize(user: string, nx: number, ny: number): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.gridSizes)
      const parsed: unknown = raw ? JSON.parse(raw) : {}
      const all: Record<string, unknown> = isRecord(parsed) ? { ...parsed } : {}
      all[user] = { nx, ny }
      localStorage.setItem(STORAGE_KEYS.gridSizes, JSON.stringify(all))
    } catch {/* storage unavailable */}
  }

  /**
   * Применяет сохранённые размеры лабиринта для текущего пользователя.
   *
   * Если для пользователя есть сохранённые размеры, они записываются в поля `#nx`/`#ny`.
   * Если сохранённых размеров нет, используются текущие значения полей (по умолчанию 10×8).
   * В обоих случаях значения проверяются на соответствие `LIMITS` и лабиринт перегенерируется.
   *
   * Вызывается при инициализации, а также после входа и выхода.
   *
   * @returns {void}
   */
  function applyUserGridSize(): void {
    const user = getCurrentUser() ?? GUEST_NAME
    const saved = getSavedGridSize(user)

    let columns: number, rows: number
    if (saved) {
      columns = saved.nx
      rows = saved.ny
    } else {
      columns = parseInt(nxInput.value, 10)
      rows = parseInt(nyInput.value, 10)
      if (!Number.isFinite(columns) || !Number.isFinite(rows)) {
        columns = 10
        rows = 8
      }
    }

    columns = Math.min(Math.max(columns, LIMITS.minColumns), LIMITS.maxColumns)
    rows = Math.min(Math.max(rows, LIMITS.minRows), LIMITS.maxRows)

    nxInput.value = String(columns)
    nyInput.value = String(rows)

    timer.stop()
    game.reset(columns, rows)
    syncInputs()
    renderInitialStatus()
    timerValue.textContent = formatDuration(0)
    timerBar.classList.remove('is-urgent')
    updateControls()
  }

  // ---- Form (existing behaviour preserved) ----

  function syncInputs(): void {
    nxInput.value = String(game.state.nx)
    nyInput.value = String(game.state.ny)
  }

  function resetFromInputs(): void {
    let columns = parseInt(nxInput.value, 10)
    let rows = parseInt(nyInput.value, 10)

    if (Number.isFinite(columns) && Number.isFinite(rows)) {
      columns = Math.min(Math.max(columns, LIMITS.minColumns), LIMITS.maxColumns)
      rows = Math.min(Math.max(rows, LIMITS.minRows), LIMITS.maxRows)

      nxInput.value = String(columns)
      nyInput.value = String(rows)

      const user = getCurrentUser() ?? GUEST_NAME
      saveGridSize(user, columns, rows)

      timer.stop()
      game.reset(columns, rows)
      syncInputs()
      renderInitialStatus()
      timerValue.textContent = formatDuration(0)
      timerBar.classList.remove('is-urgent')
      updateControls()
    }
  }

  // ---- Auth UI ----

  function updateAuthUI(): void {
    const user = getCurrentUser()
    playerEl.textContent = user ?? t('player.guest')
    const loggedIn = user !== null
    loginBtn.disabled = loggedIn
    logoutBtn.disabled = !loggedIn

    if (lastStatus.key === 'status.initial') {
      renderInitialStatus()
    }
  }

  /**
   * Создаёт DOM-узел карточки статистики без `innerHTML`.
   *
   * Используется вместо сборки HTML-строки с интерполяцией: значения карточек проходят через i18n (`t()`) и `Intl`
   * (`formatNumber`/`formatDuration`), и вставка через `innerHTML` создала бы лишний XSS-вектор и затруднила бы аудит.
   *
   * @param {string} label - Подпись карточки (уже переведённая).
   * @param {string} value - Значение карточки (уже отформатированное).
   * @returns {HTMLDivElement} Готовый DOM-узел `.stat-card`.
   */
  function createStatCard(label: string, value: string): HTMLDivElement {
    const card = document.createElement('div')
    card.className = 'stat-card'

    const strong = document.createElement('strong')
    strong.textContent = label

    const span = document.createElement('span')
    span.textContent = value

    card.append(strong, span)
    return card
  }

  function renderStats(): void {
    const storageName = getCurrentUser() ?? GUEST_NAME
    const displayName = getCurrentUser() ?? t('player.guest')
    const p = getPlayer(storageName)

    statsEl.textContent = ''

    const h = document.createElement('h3')
    h.id = 'stats-heading'
    h.textContent = t('stats.heading', { name: displayName })
    statsEl.appendChild(h)

    const grid = document.createElement('div')
    grid.className = 'stats-grid'

    // Карточка: завершённые игры
    grid.appendChild(createStatCard(t('stats.games'), formatNumber(p.games)))
    // Карточка: суммарное время
    grid.appendChild(createStatCard(t('stats.totalTime'), formatDuration(p.totalTimeMs)))

    // Карточки лучшего времени по сложности/режиму
    for (const d of [DIFFICULTY.EASY, DIFFICULTY.MEDIUM, DIFFICULTY.HARD]) {
      for (const m of [MODE.DEMO, MODE.TIMED]) {
        const v = p.best[d]?.[m]
        const label = `${t(`difficulty.${d}`)} / ${t(`mode.${m}`)}`
        const value = typeof v === 'number' ? formatDuration(v) : '—'
        grid.appendChild(createStatCard(label, value))
      }
    }

    statsEl.appendChild(grid)
  }

  // ---- Theme / locale wiring ----

  /**
   * Явная смена темы пользователем: сохраняем preference и перерисовываем сцену.
   * `redraw()` идемпотентен и читает актуальные `--color-canvas-*`, поэтому состояние игры (сетка, позиция игрока, `pathCells`, фаза)
   * не меняется — только палитра.
   *
   * После смены снимаем фокус с селекта, чтобы последующие нажатия стрелок не продолжали менять тему (вместо перемещения игрока).
   */
  themeSelect.addEventListener('change', () => {
    setThemePreference(themeSelect.value)
    game.redraw()
    themeSelect.blur()
  })

  /**
   * Смена языка: применяем локаль, переводим статические элементы (`data-i18n` / `data-i18n-aria-label`),
   * перерисовываем динамические строки (статус, аккаунт, статистика) без перезагрузки страницы.
   *
   * Для `status.initial` параметр `{ name }` — это display-name гостя или пользователя, он локализуется (`Guest` / `Гость`).
   * Смена локали пересчитывает шаблон через `renderStatus()` и `updateAuthUI()`.
   *
   * После смены снимаем фокус с селекта, чтобы стрелки не продолжали переключать язык.
   */
  localeSelect.addEventListener('change', () => {
    setLocale(localeSelect.value)
    applyTranslations()

    renderStatus()
    updateAuthUI()
    renderStats()
    localeSelect.blur()
  })

  // ---- System theme ----

  /**
   * Смена системной темы через `prefers-color-scheme`.
   *
   * Перерисовываем canvas только если пользователь не переопределил тему явно (`preference === 'system'`).
   * При `'light'` или `'dark'` CSS по-прежнему управляет токенами через `data-theme`, но палитра canvas
   * уже следует явному выбору, и перерисовка не требуется.
   *
   * `getComputedStyle()` внутри `getCanvasColors()` вызывается в `redraw()`
   * и вынуждает синхронный recalc стилей — к моменту вызова медиа-запрос
   * уже применён, поэтому функция возвращает актуальные значения.
   */
  const systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)')
  const onSystemThemeChange = (): void => {
    if (getThemePreference() === 'system') {
      game.redraw()
    }
  }

  systemThemeMedia.addEventListener('change', onSystemThemeChange)

  // ---- Event wiring ----

  startBtn.addEventListener('click', () => {
    const columns = parseInt(nxInput.value, 10)
    const rows = parseInt(nyInput.value, 10)
    game.startGame(
      Number.isFinite(columns) ? columns : game.state.nx,
      Number.isFinite(rows) ? rows : game.state.ny
    )
    syncInputs()
  })

  autosearchBtn.addEventListener('click', () => {
    if (currentMode !== MODE.DEMO) return
    game.startSearch()
  })

  modeSelect.addEventListener('change', () => {
    currentMode = parseMode(modeSelect.value)
    game.state.allowSearch = currentMode === MODE.DEMO
    updateControls()
  })

  difficultySelect.addEventListener('change', () => {
    currentDifficulty = parseDifficulty(difficultySelect.value)
  })

  document.addEventListener('keydown', game.handleKeyDown)
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    resetFromInputs()
  })

  // ---- Auth ----

  loginBtn.addEventListener('click', () => {
    loginNameInput.value = getCurrentUser() ?? ''
    loginDialog.returnValue = ''
    loginDialog.showModal()
    loginNameInput.focus()
  })

  loginCancelBtn.addEventListener('click', () => {
    loginDialog.returnValue = ''
    loginDialog.close()
  })

  loginDialog.addEventListener('close', () => {
    if (loginDialog.returnValue === 'ok') {
      const name = loginNameInput.value

      if (login(name)) {
        updateAuthUI()
        renderStats()
        applyUserGridSize()
      }
    }

    loginBtn.focus()
  })

  logoutBtn.addEventListener('click', () => {
    logout()
    updateAuthUI()
    renderStats()
    applyUserGridSize()
  })

  // ---- Init ----

  syncInputs()
  updateAuthUI()
  renderStats()
  applyUserGridSize()
  game.state.allowSearch = currentMode === MODE.DEMO
  updateControls()
  timerValue.textContent = formatDuration(0)
  renderInitialStatus()
})