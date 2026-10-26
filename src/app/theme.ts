/**
 * Модуль темизации.
 *
 * Отвечает за:
 *  - чтение и запись пользовательского preference темы (`light` / `dark` / `system`);
 *  - применение preference к DOM через `data-theme` на `<html>`;
 *  - чтение текущей палитры Canvas из CSS-токенов для синхронизации цвета игрового поля с активной темой.
 *
 * В `localStorage` хранится именно preference, а не resolved value.
 * Resolved theme вычисляется декларативно в CSS (`prefers-color-scheme` + `:root[data-theme=...]`),
 * без отдельного JS-вычисления.
 */

import type { CanvasColors } from './renderer'

/**
 * Preference темы пользователя.
 */
export type ThemePreference = 'system' | 'light' | 'dark'

/**
 * Ключ `localStorage`, под которым хранится preference темы.
 *
 * Значение — одна из строк: `'system'`, `'light'`, `'dark'`.
 * Resolved value (конкретная тема после применения `prefers-color-scheme`) сюда не пишется.
 *
 * @constant
 * @type {string}
 */
const THEME_KEY = 'maze.theme'

/**
 * Допустимые значения preference.
 *
 * Используется для валидации данных, пришедших из `localStorage` или из UI-контрола:
 * любой неизвестный вариант трактуется как `'system'`, чтобы повреждённые/устаревшие значения не ломали интерфейс.
 *
 * @constant
 * @type {ReadonlySet<'system'|'light'|'dark'>}
 */
const THEMES: ReadonlySet<string> = new Set(['system', 'light', 'dark'])

function isThemePreference(value: string | null): value is ThemePreference {
  return value !== null && THEMES.has(value)
}

/**
 * Читает сохранённый пользователем preference темы.
 *
 * Порядок разрешения:
 *  1. Валидное значение из `localStorage['maze.theme']`.
 *  2. Фолбэк на `'system'` — если `localStorage` недоступен (приватный режим, политики браузера),
 *     значение отсутствует или повреждено.
 *
 * `'system'` выбран фолбэком осознанно: это наименее навязчивое поведение —
 * интерфейс следует системной настройке, пока пользователь явно не переопределит её.
 *
 * @returns {'system'|'light'|'dark'} Текущий preference темы.
 */
export function getThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return isThemePreference(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

/**
 * Применяет preference темы к DOM.
 *
 * Механика dual-signal pattern:
 *  - `'system'` → атрибут `data-theme` удаляется; CSS-медиа-блок `@media (prefers-color-scheme: dark) :root:not([data-theme])` начинает управлять токенами;
 *  - `'light'` / `'dark'` → на `<html>` ставится `data-theme` с этим значением; он побеждает медиа-запрос в обе стороны.
 *
 * Функция идемпотентна и не пишет в `localStorage` — только DOM.
 * Это позволяет отделить «применить» от «сохранить» и даёт возможность вызывать её на старте без побочной записи в хранилище.
 *
 * @param {string} preference - Желаемый preference. Невалидные значения трактуются как `'system'`.
 * @returns {'system'|'light'|'dark'} Нормализованный preference, который был фактически применён.
 */
export function applyTheme(preference: string): ThemePreference {
  const pref: ThemePreference = isThemePreference(preference) ? preference : 'system'

  if (pref === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.dataset.theme = pref
  }

  return pref
}

/**
 * Сохраняет и применяет preference темы.
 *
 * Вызывается из UI-контрола при явном выборе пользователя.
 * Пишет preference в `localStorage` и сразу же применяет к DOM.
 *
 * Порядок операций: сначала `applyTheme` (визуальный отклик — немедленный), затем запись в `localStorage`.
 * Если запись упадёт (например, квота или запрет политики), текущая сессия всё равно получит корректное поведение —
 * тема применится, просто не переживёт перезагрузку.
 *
 * @param {string} preference - Желаемый preference. Невалидные значения трактуются как `'system'`.
 * @returns {'system'|'light'|'dark'} Нормализованный preference, который был фактически применён и (при успехе) сохранён.
 */
export function setThemePreference(preference: string): ThemePreference {
  const pref = applyTheme(preference)

  try {
    localStorage.setItem(THEME_KEY, pref)
  } catch {/* storage unavailable */}

  return pref
}

/**
 * Инициализирует тему при старте приложения.
 *
 * Читает preference и применяет его к DOM. Намеренно не пишет в `localStorage` при инициализации:
 * если пользователь ещё не делал выбора, `'system'` должен остаться неявным,
 * а не материализоваться в хранилище как явный выбор.
 *
 * При загрузке страницы тему уже применяет inline-скрипт в `<head>` (pre-paint), чтобы избежать вспышки неверной темы.
 * Этот вызов — идемпотентное подтверждение и точка опоры для последующей логики, которая может зависеть от фактического preference.
 *
 * @returns {'system'|'light'|'dark'} Применённый preference темы.
 */
export function initTheme(): ThemePreference {
  const pref = getThemePreference()
  applyTheme(pref)
  return pref
}

/**
 * Читает актуальную палитру Canvas из CSS custom properties.
 *
 * Источник правды для цветов игрового поля — CSS-токены `--color-canvas-*`, объявленные в theme-блоках `src/styles/index.css`.
 * Рендерер Canvas не содержит цветовых литералов: он получает палитру через эту функцию, чтобы цвета поля совпадали с активной темой
 * автоматически, без дублирования значений в JS.
 *
 * Значения читаются на момент вызова: если тема изменилась (`data-theme` / `prefers-color-scheme`),
 * но Canvas ещё не перерисован, функция уже вернёт новую палитру. Порядок «сменить тему → перерисовать»
 * обеспечивает вызывающий код (см. `main.js`).
 *
 * `getComputedStyle()` вынуждает синхронный recalc стилей — это ожидаемо и приемлемо:
 * вызов происходит только при инициализации и при смене темы, не в горячем пути отрисовки кадра.
 *
 * @returns {CanvasColors} Палитра Canvas для текущей активной темы.
 */
export function getCanvasColors(): CanvasColors {
  const style = getComputedStyle(document.documentElement)
  const read = (name: string): string => style.getPropertyValue(name).trim()

  return {
    background: read('--color-canvas-bg'),
    wall: read('--color-canvas-wall'),
    explored: read('--color-canvas-explored'),
    path: read('--color-canvas-path'),
    playerFill: read('--color-canvas-player-fill'),
    playerStroke: read('--color-canvas-player-stroke')
  }
}
