/**
 * Модуль интернационализации.
 *
 * Отвечает за:
 *  - выбор активной локали (сохранённая → язык браузера → `en`);
 *  - переключение локали с сохранением выбора в `localStorage`;
 *  - перевод ключей с подстановкой именованных параметров;
 *  - безопасный фолбэк на `en` при отсутствии ключа;
 *  - локаль-зависимое форматирование чисел и длительности через `Intl`.
 *
 * Каталоги — плоские объекты «ключ → шаблон». Ключи стабильные и семантические, с точечной нотацией (`theme.label`, `status.win`).
 * Плюрализация реализуется через отдельные ключи, выбираемые вызывающим кодом (`item.one` / `item.other`), а не через runtime-движок правил.
 */

import en from '../locales/en'
import ru from '../locales/ru'

/**
 * Каталоги переводов по локалям.
 *
 * Ключ — BCP 47 тег (`'en'`, `'ru'`), значение — плоский объект «семантический ключ → строка-шаблон».
 *
 * @constant
 * @type {Readonly<Record<string, Readonly<Record<string, string>>>>}
 */
const CATALOGS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  en,
  ru
}

/**
 * Множество поддерживаемых локалей.
 *
 * Используется для валидации значений из `localStorage` и от `navigator.language`;
 * любая неподдерживаемая локаль трактуется как `DEFAULT_LOCALE`, чтобы повреждённые/устаревшие значения не ломали UI.
 *
 * @constant
 * @type {ReadonlySet<string>}
 */
const SUPPORTED: ReadonlySet<string> = new Set(['en', 'ru'])

/**
 * Локаль по умолчанию и фолбэк-каталог.
 *
 * @constant
 * @type {string}
 */
const DEFAULT_LOCALE = 'en'

/**
 * Ключ `localStorage`, под которым хранится выбранная пользователем локаль.
 *
 * @constant
 * @type {string}
 */
const STORAGE_KEY = 'maze.locale'

/**
 * Активная локаль модуля. Меняется только через `initI18n` / `setLocale`.
 *
 * @type {string}
 */
let currentLocale = DEFAULT_LOCALE

/**
 * Определяет локаль для инициализации.
 *
 * Порядок разрешения (по приоритету):
 *  1. Сохранённый выбор из `localStorage['maze.locale']`, если он поддерживается.
 *  2. Язык браузера (`navigator.languages[0]` или `navigator.language`), нормализованный до базового тега (`ru-RU` → `ru`) и проверенный на поддержку.
 *  3. `DEFAULT_LOCALE` (`'en'`).
 *
 * Отдельный приоритет для сохранённого выбора важен: пользователь мог явно выбрать язык,
 * отличный от системного, и это должно переживать перезагрузку.
 *
 * @returns {string} BCP 47 тег поддерживаемой локали.
 */
function detectLocale(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && SUPPORTED.has(stored)) return stored
  } catch {/* storage unavailable */}

  const navLangs = navigator.languages ?? []
  const nav = (navLangs[0] ?? navigator.language ?? DEFAULT_LOCALE).toLowerCase()
  const base = nav.split('-')[0]

  return SUPPORTED.has(base) ? base : DEFAULT_LOCALE
}

/**
 * Инициализирует модуль i18n: определяет локаль и фиксирует её в DOM.
 *
 * Устанавливает `lang` на `<html>` — это влияет на:
 *  - произношение скринридером;
 *  - выбор правил переноса, кавычек и прочих типографских правил;
 *  - поведение встроенного перевода браузера.
 *
 * Намеренно не пишет в `localStorage`: если пользователь ещё не делал выбора,
 * `navigator.language`-фолбэк не должен материализоваться как явный выбор.
 *
 * @returns {string} Применённая локаль.
 */
export function initI18n(): string {
  currentLocale = detectLocale()
  document.documentElement.lang = currentLocale
  return currentLocale
}

/**
 * Возвращает активную локаль.
 *
 * @returns {string} BCP 47 тег текущей локали.
 */
export function getLocale(): string {
  return currentLocale
}

/**
 * Устанавливает активную локаль и сохраняет выбор.
 *
 * Порядок операций: валидация → обновление модульного состояния → запись в `localStorage` (best-effort) → фиксация `lang` на `<html>`.
 * Возвращает фактически применённую локаль.
 *
 * @param {string} locale - Желаемая локаль. Невалидные значения трактуются как `DEFAULT_LOCALE`.
 * @returns {string} Фактически применённая локаль.
 */
export function setLocale(locale: string): string {
  currentLocale = SUPPORTED.has(locale) ? locale : DEFAULT_LOCALE

  try {
    localStorage.setItem(STORAGE_KEY, currentLocale)
  } catch {/* storage unavailable */}

  document.documentElement.lang = currentLocale
  return currentLocale
}

/**
 * Возвращает перевод по ключу с подстановкой именованных параметров.
 *
 * Порядок разрешения:
 *  1. Ключ в каталоге текущей локали.
 *  2. Ключ в каталоге `DEFAULT_LOCALE` (`en`) + `console.warn`.
 *  3. Если ключа нет нигде — возвращается сам ключ как строка + `console.warn`.
 *
 * Подстановка выполняется через `String.prototype.replace` с регекспом `\{(\w+)\}` по именованным параметрам.
 * Безопасность: результат предназначен для установки через `textContent` / `setAttribute` / `aria-*`, не через `innerHTML`.
 *
 * @param {string} key - Семантический ключ (например, `'status.win'`).
 * @param {Record<string, string|number>} [params] - Именованные параметры для подстановки в шаблон.
 * @returns {string} Переведённая и параметризованная строка.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const catalog = CATALOGS[currentLocale] ?? {}
  const fallback = CATALOGS[DEFAULT_LOCALE]

  let template = catalog[key]

  if (template === undefined) {
    if (fallback[key] !== undefined) {
      console.warn(
        `[i18n] Missing key "${key}" for "${currentLocale}", using "${DEFAULT_LOCALE}"`
      )
      template = fallback[key]
    } else {
      console.warn(`[i18n] Missing key "${key}" in all catalogs`)
      return key
    }
  }

  const values = params ?? {}
  return String(template).replace(/\{(\w+)\}/g, (_, name: string) => {
    return Object.hasOwn(values, name) ? String(values[name]) : `{${name}}`
  })
}

/**
 * Форматирует число по правилам текущей локали.
 *
 * @param {number} value - Число для форматирования.
 * @returns {string} Строковое представление в текущей локали.
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(currentLocale).format(value)
}

/**
 * Форматирует длительность в миллисекундах как `MM:SS`.
 *
 * Минуты и секунды дополняются ведущим нулём через `Intl.NumberFormat` с `minimumIntegerDigits: 2` и `useGrouping: false`.
 *
 * Отрицательные значения защищаются `Math.max(0, ...)`.
 *
 * @param {number} ms - Длительность в миллисекундах.
 * @returns {string} Строка вида `"01:23"`.
 */
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(Number(ms) / 1000))
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60

  const nf = new Intl.NumberFormat(currentLocale, {
    minimumIntegerDigits: 2,
    useGrouping: false
  })

  return `${nf.format(minutes)}:${nf.format(seconds)}`
}

/**
 * Применяет переводы к статическим элементам DOM.
 *
 * Обрабатывает три декларативных атрибута:
 *  - `data-i18n` — заменяет `textContent` элемента переводом ключа;
 *  - `data-i18n-aria-label` — устанавливает `aria-label`;
 *  - `data-i18n-title` — устанавливает `title`.
 *
 * Заменяется `textContent`, а не `innerHTML`: переводы и пользовательские данные не должны интерпретироваться как разметка.
 *
 * @param {ParentNode} [root=document] - Корень поиска.
 * @returns {void}
 */
export function applyTranslations(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]')
    .forEach((el) => {
      const key = el.dataset.i18n
      if (key !== undefined) {
        el.textContent = t(key)
      }
    })

  root.querySelectorAll<HTMLElement>('[data-i18n-aria-label]')
    .forEach((el) => {
      const key = el.dataset.i18nAriaLabel
      if (key !== undefined) {
        el.setAttribute('aria-label', t(key))
      }
    })

  root.querySelectorAll<HTMLElement>('[data-i18n-title]')
    .forEach((el) => {
      const key = el.dataset.i18nTitle
      if (key !== undefined) {
        el.setAttribute('title', t(key))
      }
    })
}
