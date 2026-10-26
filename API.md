# API reference — maze

TypeScript-версия. Структура:
- `src/lib/` — чистые модули (без DOM/canvas/renderer); допускаются `performance.now`/`setInterval`/`setTimeout` и storage-API.
- `src/app/` — presentation/wiring (DOM/canvas/renderer).
- `src/main.ts` — точка входа; импортирует из `./app/*` и `./lib/*`.

Импорты внутри проекта — без расширения (`moduleResolution: "Bundler"`, Vite).

## `lib/constants.ts`

### `WALL`

```typescript
WALL: Readonly<{ TOP: 1, LEFT: 2, BOTTOM: 4, RIGHT: 8 }>
```

Битовая маска стен клетки. Значения: `TOP = 1`, `LEFT = 2`, `BOTTOM = 4`, `RIGHT = 8`.
Используется как биты в числе клетки сетки.

### `FULL_WALL`

```typescript
FULL_WALL: number
```

Маска всех четырёх стен: `WALL.TOP | WALL.LEFT | WALL.BOTTOM | WALL.RIGHT`.

### `LIMITS`

```typescript
LIMITS: Readonly<{
  minColumns: 3,
  minRows: 3,
  maxColumns: 111,
  maxRows: 80
}>
```

Границы размеров лабиринта, применяемые при сбросе игры.

### `MODE`

```typescript
MODE: Readonly<{ DEMO: 'demo', TIMED: 'timed' }>
```

Режимы таймера. В `'demo'` автопоиск разрешён; в `'timed'` — нет.

### `Mode`

```typescript
type Mode = 'demo' | 'timed'
```

Union-тип режима таймера, выводимый из `MODE`.

### `DIFFICULTY`

```typescript
DIFFICULTY: Readonly<{ EASY: 'easy', MEDIUM: 'medium', HARD: 'hard' }>
```

Уровни сложности, влияющие на лимит времени в режиме `'timed'`.

### `Difficulty`

```typescript
type Difficulty = 'easy' | 'medium' | 'hard'
```

Union-тип сложности, выводимый из `DIFFICULTY`.

### `TIMING`

```typescript
TIMING: Readonly<{
  stepTimeMs: 1000,
  exploreFraction: 0.08,
  minTimeLimitMs: 5000,
  difficultyFactor: Readonly<{ easy: 0.9, medium: 0.6, hard: 0.4 }>
}>
```

Параметры эмпирического расчёта лимита времени. См. `difficulty.computeTimeLimit`.

### `STORAGE_KEYS`

```typescript
STORAGE_KEYS: Readonly<{
  currentUser: 'maze.currentUser',
  gridSizes: 'maze.gridSizes.v1',
  stats: 'maze.stats.v1'
}>
```

Ключи `localStorage`/`sessionStorage` (англоязычные слаги).

### `GUEST_NAME`

```typescript
GUEST_NAME: 'гость'
```

Имя по умолчанию; под ним пишется статистика неаутентифицированного игрока.

## `lib/player.ts`

### `Move`

```typescript
interface Move {
  dx: number
  dy: number
  wall: number
}
```

Описание одного хода: смещение по сетке и бит стены, который блокирует ход.

### `ExitCheckState`

```typescript
interface ExitCheckState {
  playerX: number
  playerY: number
  nx: number
  exitY: number
}
```

Минимальная проекция состояния игры для проверки выхода.

### `resolveMove(key)`

```typescript
resolveMove(key: string): Move | null
```

Возвращает описание хода для клавиши стрелки. Для неизвестной клавиши возвращает `null`. Описание содержит смещение по сетке и бит стены, который проверяется перед перемещением.

### `isPassable(grid, x, y, move)`

```typescript
isPassable(grid: number[][], x: number, y: number, move: Move): boolean
```

Проверяет, отсутствует ли стена в направлении хода. Не проверяет границы сетки: `x` и `y` должны указывать на существующую клетку.

### `isAtExit(state)`

```typescript
isAtExit(state: ExitCheckState): boolean
```

Проверяет, стоит ли игрок в клетке выхода: `playerX === nx - 1` и `playerY === exitY`.

## `lib/grid.ts`

### `createFullGrid(nx, ny)`

```typescript
createFullGrid(nx: number, ny: number): number[][]
```

Создаёт сетку `nx × ny`, в каждой клетке которой установлены все стены (`FULL_WALL`).

### `generateMaze(nx, ny)`

```typescript
generateMaze(nx: number, ny: number): number[][]
```

Генерирует лабиринт итеративным алгоритмом роста из случайной клетки. Открывает стены к случайным непосещённым соседям; если текущая клетка заблокирована, продолжает от случайной уже посещённой клетки.
После `nx * ny - 1` открытий сетка образует связное дерево. Ожидаются положительные целые `nx` и `ny`; проверка не выполняется.

### `measureSolutionLength(grid, nx, ny, startX, startY, exitX, exitY)`

```typescript
measureSolutionLength(
  grid: number[][],
  nx: number,
  ny: number,
  startX: number,
  startY: number,
  exitX: number,
  exitY: number
): number
```

Длина единственного пути от старта до выхода (число переходов), найденная BFS. Возвращает `-1`, если выход недостижим (для корректного лабиринта не встречается).
Используется в `startGame` для расчёта лимита времени в режиме `'timed'`.

## `app/renderer.ts`

### `MazeLayout`

```typescript
interface MazeLayout {
  cellWidth: number
  cellHeight: number
  originX: number
  originY: number
}
```

Геометрия сетки на canvas.

### `CanvasColors`

```typescript
interface CanvasColors {
  background: string
  wall: string
  explored: string
  path: string
  playerFill: string
  playerStroke: string
}
```

Палитра цветов Canvas для отрисовки лабиринта. Значения читаются из CSS custom properties `--color-canvas-*` в момент вызова draw-метода.

### `MazeRenderer`

```typescript
interface MazeRenderer {
  clear(width: number, height: number): void
  fillCell(layout: MazeLayout, x: number, y: number, fillColor: string, strokeColor: string): void
  eraseCell(layout: MazeLayout, x: number, y: number): void
  markExplored(layout: MazeLayout, x: number, y: number): void
  markPath(layout: MazeLayout, x: number, y: number): void
  drawPlayer(layout: MazeLayout, x: number, y: number): void
  drawBorder(layout: MazeLayout, nx: number, ny: number): void
  drawWalls(layout: MazeLayout, grid: number[][], nx: number, ny: number): void
  openExit(layout: MazeLayout, nx: number, exitY: number): void
}
```

Набор методов отрисовки. Все методы читают цвета из текущей палитры (`getColors()`) при каждой отрисовке.

- `clear(width, height)` — очищает canvas.
- `fillCell(layout, x, y, fillColor, strokeColor)` — заливает клетку с отступом 2 px.
- `eraseCell(layout, x, y)` — стирает клетку цветом фона.
- `markExplored(layout, x, y)` — помечает клетку исследованной.
- `markPath(layout, x, y)` — помечает клетку путём.
- `drawPlayer(layout, x, y)` — рисует игрока.
- `drawBorder(layout, nx, ny)` — рисует внешнюю рамку.
- `drawWalls(layout, grid, nx, ny)` — рисует верхние и левые стены клеток.
- `openExit(layout, nx, exitY)` — закрашивает участок правой границы (линией 4px с `lineCap='square'`) цветом фона для визуального разрыва.

### `computeLayout(width, height, nx, ny)`

```typescript
computeLayout(width: number, height: number, nx: number, ny: number): MazeLayout
```

Вычисляет `cellWidth`, `cellHeight`, `originX`, `originY`. По ширине и высоте резервируется по 20 px; остаток центрируется, к началу добавляется 0.5 px.

### `createRenderer(ctx, getColors)`

```typescript
createRenderer(
  ctx: CanvasRenderingContext2D,
  getColors: () => CanvasColors
): MazeRenderer
```

Создаёт набор методов рисования. Все методы используют переданный `ctx` и предполагают, что он не `null`. Цвета читаются через `getColors()` при каждой отрисовке (см. `getCanvasColors` в `app/theme.ts`).

## `lib/search.ts`

### `SolveResult`

```typescript
interface SolveResult {
  found: boolean
  path: Array<{ x: number, y: number }>
}
```

Результат поиска пути. `path` включает и стартовую, и выходную клетки; пуст при `found === false`.

### `SolveMazeInput`

```typescript
interface SolveMazeInput {
  grid: number[][]
  nx: number
  ny: number
  startX: number
  startY: number
  exitY: number
}
```

Входные параметры поиска пути.

### `solveMaze(input)`

```typescript
solveMaze(input: SolveMazeInput): SolveResult
```

Синхронный BFS по сетке битовых масок стен. Возвращает `{ found, path }`, где `path` включает и стартовую, и выходную клетки.
При недостижимом выходе (`found === false`) `path` пуст. Не использует `renderer`, DOM, canvas или интервалы; чистая функция.
Вызывается из `src/app/game.ts` в `startSearch()`.

## `lib/timer.ts`

### `TimerTick`

```typescript
interface TimerTick {
  mode: 'demo' | 'timed'
  elapsedMs: number
  remainingMs: number | null
}
```

Снимок состояния таймера, передаваемый в `onTick`.

### `TimerStartOptions`

```typescript
interface TimerStartOptions {
  mode?: 'demo' | 'timed'
  limitMs?: number
}
```

Параметры запуска таймера.

### `TimerHooks`

```typescript
interface TimerHooks {
  onTick?: (tick: TimerTick) => void
  onExpire?: () => void
}
```

Хуки таймера.

### `MazeTimer`

```typescript
interface MazeTimer {
  start(opts?: TimerStartOptions): void
  stop(): void
  pause(): void
  resume(): void
  getElapsed(): number
  isRunning(): boolean
}
```

API таймера.

### `createTimer(hooks?)`

```typescript
createTimer(hooks?: TimerHooks): MazeTimer
```

Независимый от игры таймер. В `'timed'` по достижении `limitMs` вызывает `onExpire()` и останавливается. Паузы (`pause`/`resume`, например при `visibilitychange`) не входят в эффективное время.
Интервал снимается при `pause` — колбэк в фоне не крутится.

## `lib/stats.ts`

### `PlayerStats`

```typescript
interface PlayerStats {
  games: number
  totalTimeMs: number
  best: {
    easy: Record<string, number | null>
    medium: Record<string, number | null>
    hard: Record<string, number | null>
  }
}
```

Статистика одного игрока. Ключи внутри `best[difficulty]` — строки режима (`'demo' | 'timed'` на практике).

### `RecordWinInput`

```typescript
interface RecordWinInput {
  difficulty: string
  mode: string
  elapsedMs: number
}
```

Параметры записи победы.

### `getPlayer(name)`

```typescript
getPlayer(name: string): PlayerStats
```

Возвращает статистику игрока (или пустую, если такого ещё нет).
Пустое имя трактуется как `GUEST_NAME` (`'гость'`).

### `recordWin(name, record)`

```typescript
recordWin(name: string, record: RecordWinInput): PlayerStats
```

Инкрементирует `games`, добавляет `elapsedMs` в `totalTimeMs`, обновляет лучшее время для пары (difficulty, mode), если оно лучше или его нет.
Сохраняет в `localStorage[STORAGE_KEYS.stats]`.

## `lib/auth.ts`

### `getCurrentUser() / login(name) / logout()`

```typescript
getCurrentUser(): string | null
login(name: string): boolean
logout(): void
```

"Залогинен" = в `sessionStorage[STORAGE_KEYS.currentUser]` лежит непустая строка. Переживает F5, не переживает закрытие вкладки.

## `lib/difficulty.ts`

### `ComputeTimeLimitInput`

```typescript
interface ComputeTimeLimitInput {
  nx: number
  ny: number
  solutionLength: number
  difficulty: string
}
```

Входные параметры расчёта лимита времени. Допустимые значения `difficulty`: `'easy' | 'medium' | 'hard'`; неизвестное значение даёт фактор 1.0.

### `computeTimeLimit(input)`

```typescript
computeTimeLimit(input: ComputeTimeLimitInput): number
```

Эмпирический лимит времени (мс):
`max(TIMING.minTimeLimitMs, round((pathMs + exploreMs) * difficultyFactor))`,
где `pathMs = max(1, solutionLength) * TIMING.stepTimeMs`,
`exploreMs = max(0, nx*ny - solutionLength - 1) * TIMING.stepTimeMs * TIMING.exploreFraction`.

## `app/game.ts`

### `MazePhase`

```typescript
type MazePhase = 'idle' | 'playing' | 'finished'
```

Фазовая модель игры.

### `MazeGameState`

```typescript
interface MazeGameState {
  nx: number
  ny: number
  layout: MazeLayout
  grid: number[][]
  playerX: number
  playerY: number
  exitY: number
  phase: MazePhase
  allowSearch: boolean
  pathCells: Array<{ x: number, y: number }>
}
```

Состояние игры. `allowSearch` управляется вызывающим кодом (`main.ts`) из режима таймера: Demo → `true`, Timed → `false`.

### `StartInfo`

```typescript
interface StartInfo {
  nx: number
  ny: number
  solutionLength: number
}
```

Информация о старте игры, передаваемая в `onStart`.

### `MazeGame`

```typescript
interface MazeGame {
  state: MazeGameState
  reset(columns?: number, rows?: number): void
  startGame(columns?: number, rows?: number): void
  endGame(): void
  startSearch(): void
  redraw(): void
  handleKeyDown(event: KeyboardEvent): void
  isAtExit(): boolean
}
```

Публичный API игры.

- `state` — состояние игры.
- `reset(columns?, rows?)` — сбрасывает игру; фаза `'idle'`.
- `startGame(columns?, rows?)` — регенерирует лабиринт, замеряет длину пути, переводит в `'playing'` и вызывает `options.onStart`.
- `endGame()` — переводит в `'finished'`.
- `startSearch()` — синхронно находит путь от текущей позиции игрока до выхода и подсвечивает его, если `state.allowSearch === true` и фаза `'playing'`; иначе — no-op. Игрок не двигается; повторный вызов идемпотентен.
- `redraw()` — идемпотентно перерисовывает сцену из текущего `state`, используется при смене темы.
- `handleKeyDown(event)` — обработчик клавиатуры; ходы принимаются только в фазе `'playing'`.
- `isAtExit()` — проверяет, стоит ли игрок в выходе.

### `OnStartCallback`

```typescript
type OnStartCallback = (info: StartInfo) => void
```

Колбэк старта игры.

### `OnWinCallback`

```typescript
type OnWinCallback = () => void
```

Колбэк победы. Вызывается ровно один раз при достижении выхода.

### `UseMazeGameOptions`

```typescript
interface UseMazeGameOptions {
  width?: number
  height?: number
  columns?: number
  rows?: number
  getColors: () => CanvasColors
  onStart?: OnStartCallback
  onWin?: OnWinCallback
}
```

Опции создания игры. `getColors` обязателен; остальные — опциональны.

### `useMazeGame(canvas, options)`

```typescript
useMazeGame(canvas: HTMLCanvasElement, options: UseMazeGameOptions): MazeGame
```

Создаёт игру на canvas. По умолчанию: `width = 800`, `height = 500`, `columns = 10`, `rows = 8`.
Устанавливает размеры canvas, создаёт состояние и рендерер, затем вызывает `reset` (фаза `'idle'`).
Игра переходит в `'playing'` только после явного вызова `startGame`.
`options.getColors` обязателен для получения актуальной палитры Canvas (см. `theme.ts`).
Если `canvas.getContext('2d')` вернул `null`, функция бросает `Error` (сохранение исходного поведения падения).

## `app/theme.ts`

### `ThemePreference`

```typescript
type ThemePreference = 'system' | 'light' | 'dark'
```

Preference темы пользователя.

### `getThemePreference()`

```typescript
getThemePreference(): ThemePreference
```

Читает сохранённый preference из `localStorage['maze.theme']`. Невалидное/отсутствующее значение → `'system'`.

### `applyTheme(preference)`

```typescript
applyTheme(preference: string): ThemePreference
```

Применяет preference к DOM: `'system'` удаляет `data-theme`, `'light'`/`'dark'` — ставит. Невалидное значение → `'system'`. Не пишет в `localStorage`.

### `setThemePreference(preference)`

```typescript
setThemePreference(preference: string): ThemePreference
```

Применяет preference и сохраняет его в `localStorage` (best-effort).

### `initTheme()`

```typescript
initTheme(): ThemePreference
```

Инициализация темы: читает preference и применяет. В `localStorage` не пишет.

### `getCanvasColors()`

```typescript
getCanvasColors(): CanvasColors
```

Читает актуальную палитру Canvas из CSS custom properties `--color-canvas-*` на момент вызова.

## `app/i18n.ts`

### `initI18n()`

```typescript
initI18n(): string
```

Определяет локаль (сохранённая → язык браузера → `'en'`) и фиксирует `lang` на `<html>`. В `localStorage` не пишет.

### `getLocale()`

```typescript
getLocale(): string
```

Возвращает активную локаль (BCP 47 тег).

### `setLocale(locale)`

```typescript
setLocale(locale: string): string
```

Устанавливает локаль (невалидное значение → `'en'`), сохраняет в `localStorage` и обновляет `lang` на `<html>`. Возвращает фактически применённую локаль.

### `t(key, params?)`

```typescript
t(key: string, params?: Record<string, string | number>): string
```

Возвращает перевод по ключу с подстановкой `{name}`-параметров. Фолбэк: текущая локаль → `'en'` → сам ключ (с `console.warn`).

### `formatNumber(value)`

```typescript
formatNumber(value: number): string
```

Форматирует число по правилам текущей локали (`Intl.NumberFormat`).

### `formatDuration(ms)`

```typescript
formatDuration(ms: number): string
```

Форматирует длительность в мс как `MM:SS`. Отрицательные значения → `00:00`.

### `applyTranslations(root?)`

```typescript
applyTranslations(root?: ParentNode): void
```

Применяет переводы к элементам с `data-i18n`, `data-i18n-aria-label`, `data-i18n-title`. По умолчанию корень — `document`. Заменяет `textContent` / `aria-label` / `title`, а не `innerHTML`.

## `main.ts`

Модуль точки входа, публичных экспортов не имеет. Связывает DOM:

- `#mazeCanvas` — canvas для игры;
- `#mode` — выбор режима (`demo` / `timed`);
- `#difficulty` — выбор сложности (`easy` / `medium` / `hard`);
- `#start` — кнопка запуска игры (перегенерация + запуск таймера);
- `#autosearch` — кнопка автопоиска; доступна только в Demo и во время игры; `S`/`s` — сохранённый кейбиндинг;
- `#controls` — форма размеров лабиринта;
- `#button` (Apply size) — сохраняет размеры (`#nx`, `#ny`) в `localStorage` в привязке к текущему пользователю и перегенерирует лабиринт;
- `#timer-bar` — визуальный индикатор времени;
- `#status` — текстовый статус (`role="status"`);
- `#current-player`, `#login`, `#logout` — блок аккаунта (кнопки переключают свойство `disabled` в зависимости от статуса);
- `#login-dialog`, `#login-name`, `#login-cancel` — модалка входа (нативный `<dialog>`, центрируется через CSS `margin: auto`);
- `#stats` — блок статистики;
- `#theme-select` — выбор темы (`system` / `light` / `dark`);
- `#locale-select` — выбор языка (`en` / `ru`).

При загрузке:
1. Инициализирует тему и язык.
2. Применяет сохранённые размеры лабиринта для текущего игрока (`applyUserGridSize()`).
3. Создаёт игру, таймер, синхронизирует поля формы.
4. Подписывает `keydown` на `document`, `submit` на форму, смену `visibilitychange` (пауза/резюме таймера).
5. Обрабатывает вход и выход: обновляет кнопки авторизации (`disabled`), перерисовывает статистику, применяет сохранённые размеры нового пользователя и обновляет начальный статус с именем игрока.

Импортирует: `useMazeGame` из `./app/game`; `createTimer`, `computeTimeLimit`, `getPlayer`, `recordWin`, `login`, `logout`, `getCurrentUser`, `MODE`, `DIFFICULTY`, `GUEST_NAME`, `LIMITS`, `STORAGE_KEYS` — из `./lib/*`; `initI18n`, `getLocale`, `setLocale`, `t`, `applyTranslations`, `formatNumber`, `formatDuration` — из `./app/i18n`; `initTheme`, `getThemePreference`, `setThemePreference`, `getCanvasColors` — из `./app/theme`.
