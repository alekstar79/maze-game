import { STORAGE_KEYS } from './constants'

/**
 * Возвращает имя текущего пользователя или `null`, если это гость.
 *
 * @returns {string|null}
 */
export function getCurrentUser(): string | null {
  try {
    const v = sessionStorage.getItem(STORAGE_KEYS.currentUser)
    return v && v.trim() ? v.trim() : null
  } catch {
    return null
  }
}

/**
 * Сохраняет имя пользователя в `sessionStorage` (переживает F5,
 * не переживает закрытие вкладки).
 *
 * @param {string} name - Имя; пустые/пробельные значения игнорируются.
 * @returns {boolean} `true`, если имя сохранено.
 */
export function login(name: string): boolean {
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (!trimmed) return false

  try {
    sessionStorage.setItem(STORAGE_KEYS.currentUser, trimmed)
    return true
  } catch {
    return false
  }
}

/**
 * Сбрасывает состояние «залогинен».
 *
 * @returns {void}
 */
export function logout(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.currentUser)
  } catch {/* ignore */}
}
