/**
 * Английский каталог переводов.
 *
 * Структура: плоский объект «семантический ключ → строка-шаблон».
 * Ключи сгруппированы по домену в порядке, отражающем чтение интерфейса
 * (a11y → тема → язык → игрок → аккаунт → управление → моды → сложность →
 * aria-описания → инструкции → таймер → статусы → статистика).
 *
 * Соглашения:
 *  - подстановка параметров: `{name}` (см. `t()` в `src/app/i18n.js`);
 *  - плюрализация — отдельными ключами (`item.one` / `item.other`),
 *    выбираемыми в вызывающем коде (сейчас не требуется — все счётные
 *    фразы сформулированы нейтрально по числу);
 *  - значения не содержат HTML-разметки: `t()` возвращает строку,
 *    устанавливаемую через `textContent` / `setAttribute`. Разметку
 *    (иконки, `<kbd>` и т.п.) держит HTML, а каталог даёт только
 *    текстовые фрагменты;
 *  - роль (`role`), `aria-live`, фокус и прочее поведение — это HTML/CSS/JS,
 *    не ответственность каталога.
 *
 * Экспортируется как `Object.freeze({...})`, а не «голый» объект:
 * каталог — данные только для чтения, и `Readonly` в `@type` должен
 * быть реальным контрактом, а не декоративной аннотацией. `i18n.js`
 * дополнительно морозит контейнер (`Object.freeze({ en, ru })`), так
 * что реестр каталогов защищён на двух уровнях.
 *
 * @module locales/en
 */

/**
 * Каталог переводов для локали `en`.
 *
 * Выбран фолбэком в `i18n.js` (`DEFAULT_LOCALE`): на него ссылается `t()`
 * при отсутствии ключа в текущей локали, чтобы дефекты локализации
 * деградировали в читаемый английский текст, а не в «сырой» ключ.
 *
 * @type {Readonly<Record<string, string>>}
 */
const en: Readonly<Record<string, string>> = {
  // ---- Skip link ----
  'a11y.skip': 'Skip to game',

  // ---- Theme switch ----
  // Native names в `<select>` не переводятся; здесь — только подписи
  // контрола и его опции (system/light/dark), сами по себе являющиеся
  // терминами интерфейса, а не именами файлов или констант.
  'theme.label': 'Theme',
  'theme.system': 'System',
  'theme.light': 'Light',
  'theme.dark': 'Dark',

  // ---- Locale switch ----
  // Языки в `<select>` — native names ("English", "Русский"), они заданы
  // в HTML и не проходят через i18n. Ключ — только для подписи контрола.
  'locale.label': 'Language',

  // ---- Player block ----
  'player.heading': 'Player',
  'player.playingAs': 'Playing as:',
  // Guest display name. Отличается от `GUEST_NAME` из `constants.js`:
  // `GUEST_NAME` (`'гость'`) — стабильный storage-ключ статистики,
  // он никогда не показывается пользователю; отображаемое имя локализуется
  // отдельно. Соответствие "storage-ключ → display-name" — в `main.js`.
  'player.guest': 'Guest',

  // ---- Auth ----
  // `auth.login` и `auth.dialogTitle` — разные элементы UI (кнопка в HUD
  // и заголовок модалки), поэтому ключи раздельные, даже если строки
  // совпадают в английском. В других локалях они могут разойтись.
  'auth.login': 'Log in',
  'auth.logout': 'Log out',
  'auth.dialogTitle': 'Log in',
  'auth.name': 'Name:',
  'auth.confirm': 'Confirm',
  'auth.cancel': 'Cancel',

  // ---- Controls ----
  'controls.heading': 'Controls',
  'controls.mode': 'Mode:',
  'controls.difficulty': 'Difficulty:',
  'controls.start': 'Start',
  'controls.solve': 'Solve',
  'controls.columns': 'columns:',
  'controls.rows': 'rows:',
  'controls.newGame': 'Apply size',

  // ---- Modes ----
  'mode.demo': 'Demo',
  'mode.timed': 'Timed',

  // ---- Difficulty ----
  'difficulty.easy': 'Easy',
  'difficulty.medium': 'Medium',
  'difficulty.hard': 'Hard',

  // ---- Aria labels ----
  // Заменяют статические aria-label на контейнерах:
  // см. `data-i18n-aria-label` в `index.html` и `applyTranslations()`.
  'game.aria.board': 'Maze game',
  'game.aria.canvas': 'Maze board',
  'game.aria.sidebar': 'Game controls and statistics',
  'game.aria.auth': 'Player account',
  'game.aria.controls': 'Game controls',
  'game.aria.stats': 'Player statistics',

  // ---- Instructions ----
  // Три фрагмента для `p.instructions` — намеренно разбиты, чтобы
  // `<kbd>S</kbd>` остался в HTML как настоящий семантический элемент.
  'instructions.move': 'Use arrow keys to move.',
  'instructions.solvePrefix': 'Press',
  'instructions.solveSuffix': 'for solution (Demo mode only).',
  'instructions.exit': 'Exit is on the right edge.',

  // ---- Timer ----
  // Видимый пользователю ярлык для screen reader — через
  // `visually-hidden` span с этим же ключом.
  'timer.remaining': 'Time remaining:',

  // ---- Statuses ----
  // `{name}` — display name текущего игрока (Guest или логин).
  // `{time}` — уже отформатированная строка `MM:SS` через `formatDuration`.
  // Кавычки — типографские “...”, а не программные "..." — для визуальной
  // чистоты в HUD; это литеральная строка, а не HTML.
  'status.initial': 'You can start the game with Start. Current player: “{name}”.',
  'status.win': 'You win! Time: {time}',
  'status.timeout': 'Time is up. Press Start to play again.',

  // ---- Stats ----
  // `{name}` — display name текущего игрока (Guest или логин).
  'stats.heading': 'Statistics: {name}',
  'stats.games': 'Games completed',
  'stats.totalTime': 'Total time'
}

export default en