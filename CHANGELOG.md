# Changelog

Все заметные изменения проекта **Strata** документируются в этом файле в формате [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).

## [Unreleased]

## [0.8.0] — PR 8: Virtual Goal Envelopes (NPER) & 2-Way FIFO Debts
### Added
- **Finance Core (`@strata/finance-core`):**
  - Добавлен `computeGoalsPortfolioSummary` с приоритизацией (`high → medium → low`), подсчётом общих накоплений/остатков/плана и распределением балансов по счетам хранения (`storageAllocation`).
  - В `GoalEnvelopeResult` добавлено поле `effectiveRate`.
  - Расширен `computeDebtsLedger` опциональным параметром `asOfDate`: добавлены `dueDate`, `comment`, `repaidTotalMinor`, `progress`, `daysUntilDue`, `isOverdue`, `repaymentTransactionIds`, а также счётчики `overdueCount` и `dueSoonCount`.
- **API Contract & REST API (`/api/v1`):**
  - Созданы OpenAPI 3.1 схемы (`packages/api-contract/src/goals.ts`, `debts.ts`) и роуты `/api/v1/goals`, `/api/v1/goal-transfers`, `/api/v1/debts` с проверкой владения счетами/целями (`400 INVALID_REFERENCE`), защитой инварианта `manual_repaid_minor <= amount_minor` и soft-delete.
  - В `GET /api/v1/transactions` добавлены фильтры `goal_id` и `debt_id`.
- **Web UI (`/plans`, Quick Add, Overview):**
  - В `/plans` добавлены вкладки **«Цели»** и **«Долги»** (адаптивная сетка `2×2` на мобильных), форма цели с живым NPER-предпросмотром, диалог виртуальных переводов между конвертами без движения реальных счетов, учёт долгов с фильтрами (`Все` / `Мне должны` / `Я должен`), 1-клик «Записать возврат» в Quick Add и опциональное создание операции при заведении долга.
  - В Quick Add добавлены пресеты `accountToId` / `goalId` / `debtId`, фильтрация долгов по направлению операции и живая синхронизация справочников.
  - На `/` Overview добавлена условная полоса уведомления о просроченных долгах.
- **Документация:** обновлён `README.md` с бейджами и дорожной картой, создан `CHANGELOG.md`, обновлены `AGENTS.md`, `docs/API_CONTRACT.md`, `docs/DOMAIN_MATH.md` и `docs/STATUS.md`.

### Fixed
- Детерминированная сортировка несвязанных возвратов в `computeDebtsLedger` (Pass 2 FIFO) по `occurredAt ASC`, исключающая зависимость от порядка сортировки транзакций в SQL-запросах.

---

## [0.7.1] — PR 7.1: Plans, Quick Add & Capital Polish
### Fixed
- Исправлено переполнение и перенос валюты `(RUB)` внутри `SelectTrigger`; расширены селекторы в Quick Add.
- Частичные оплаты регулярных платежей (`paidAmountMinor < amount_minor`) сохраняют статус частичной оплаты и резервируют в `Safe-to-Spend` только остаток до 100% покрытия.
- Для «Начислить проценты» добавлена автоподстановка `monthlyInterestMinor` и пассивной категории дохода.
- Реестр иконок категорий расширен до 36 иконок со smart-выводом для существующих категорий и быстрым `CategoryIconPicker` в `/capital`.
- Сетки и карточки `/plans` адаптированы под `360px` без горизонтального скролла.

---

## [0.7.0] — PR 7: Savings Rules, Promo Radar & Recurring Payments
### Added
- Реализованы правила доходности вкладов/счетов (`/api/v1/savings-rules` с воскрешением soft-deleted правил на `UNIQUE(account_id)`), Промо-радар с настраиваемым окном предупреждения (`7 / 14 / 30` дней) и регулярные платежи (`/api/v1/recurring-payments` + идемпотентные отметки по периодам `YYYY-MM`).
- Открыт раздел `/plans` в десктопной и мобильной навигации с живой связкой с `Safe-to-Spend` и Hero-уведомлениями на `/`.

---

## [0.6.5 – 0.6.9] — Expressive Neobank UI Redesign & Polish
### Changed
- **PR 6.9:** Редизайн `/operations` (Variant A, мобильные 2-колоночные карточки Доходы/Расходы без усечения крупных сумм, единый поиск и сворачиваемые фильтры).
- **PR 6.8:** Глубокий фон Obsidian/Mist (`BG-B`), Hero-полоса кредитных карт (`1A`) и единая карточка распределения портфеля на `/capital` (`2A`).
- **PR 6.7:** Редизайн `QuickAddDialog` в формате банковской карточки-чека (Variant B) со встроенным калькулятором и плавным демпфированием жидкого индикатора меню.
- **PR 6.6:** Hero-метрика на `/` (Variant C), симметричный переключатель периодов, адаптация 2FA/сессий на мобильных и настоящий frosted-blur на портале меню профиля.
- **PR 6.5:** Плавающая стеклянная панель навигации (Variant A), мобильный док, блокировка прокрутки в Spotlight Tour, безлимитные инвайт-коды (`max_uses = NULL`) и настраиваемый порядок карточек на Обзоре (`profiles.dashboard_layout`).

---

## [0.6.0] — PR 6: Dashboard Analytics, Spotlight Tour, Export, Admin & E2E
### Added
- Графики динамики и структуры трат (`Recharts` с поддержкой Privacy Blur), переключатель Месяц/Год и Savings Rate.
- Интерактивный 6-шаговый `SpotlightTourOverlay` с синхронизацией в БД.
- Экспорт данных в JSON v1.0 и CSV (UTF-8 BOM + защита от CSV formula-injection).
- Стелс-админка `/admin` (`404` для обычных пользователей), телеметрия, управление инвайт-кодами и Feature Flags.
- Сквозные Playwright E2E-тесты для Mobile (`360px`), Tablet (`768px`) и Desktop (`1280px`).

---

## [0.5.0 – 0.5.5] — Account Security, 2FA TOTP & Accent Palettes
### Added
- **PR 5.5:** Автоподтверждаемый `Dot → Digit` ввод 2FA-кода, 5 акцентных палитр (`emerald`, `ocean`, `amethyst`, `sunset`, `graphite`) и защищённая смена email.
- **PR 5:** Двухфакторная аутентификация (2FA TOTP) с `RESTRICTIVE` RLS, список и мгновенный отзыв активных сессий, а также необратимое удаление аккаунта с проверкой пароля, 2FA и защитой последнего администратора.

---

## [0.3.0 – 0.4.5] — Auth, Invite Gate, Onboarding & Core Ledger
### Added
- **PR 4.5:** Мягкий Privacy Blur, нейтральная обработка повторной регистрации, скелетоны маршрутов (`loading.tsx`) и View Transitions.
- **PR 4:** Полный CRUD для счетов (5 типов), категорий (расход/доход/пассивный доход) и операций (все 11 типов), глобальный `QuickAddDialog` и разделы `/operations` и `/capital`.
- **PR 3:** Аутентификация, инвайт-гейт (`redeem_invite_code`), 3-шаговый онбординг, темы Light/Dark/System и переключение `RU / EN`.

---

## [0.1.0 – 0.2.0] — Foundation, Supabase RLS & OpenAPI Sync
### Added
- **PR 2:** Версионированные SQL-миграции для 15 таблиц Supabase со строгим RLS, Hono OpenAPI 3.1 API (`/api/v1`, Scalar `/api/docs`) и двусторонний Delta Sync (`/sync`, `/sync/push`) с LWW-разрешением конфликтов.
- **PR 1:** Инициализация монорепозитория, `@strata/design-tokens`, `@strata/finance-core` с `golden-scenarios.json` и CI/CD.
