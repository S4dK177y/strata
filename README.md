<div align="center">
  <img src="packages/design-tokens/assets/strata-icon.svg" alt="Strata logo" width="84" height="84" />
  <h1>Strata · Страта</h1>
  <p>
    <strong>Open-source, privacy-first трекер личных финансов в стиле Expressive Neobank</strong>
    <br />
    <em>PWA (Next.js 16) + общий REST API (Hono OpenAPI 3.1) + база для нативного Android-клиента</em>
  </p>

  <p>
    <a href="https://github.com/S4dK177y/strata/actions/workflows/ci.yml"><img src="https://github.com/S4dK177y/strata/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-10B981?style=flat-square" alt="License: MIT" /></a>
    <img src="https://img.shields.io/badge/Next.js-16-0F1419?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js 16" />
    <img src="https://img.shields.io/badge/React-19-0891B2?style=flat-square&logo=react&logoColor=white" alt="React 19" />
    <img src="https://img.shields.io/badge/TypeScript-5.8-2563EB?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript 5.8" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" />
    <img src="https://img.shields.io/badge/Supabase-Postgres_%2B_RLS-059669?style=flat-square&logo=supabase&logoColor=white" alt="Supabase Postgres + RLS" />
    <img src="https://img.shields.io/badge/API-Hono_OpenAPI_3.1-F59E0B?style=flat-square&logo=hono&logoColor=white" alt="Hono OpenAPI 3.1" />
    <img src="https://img.shields.io/badge/Tests-Vitest_%2B_Playwright-7C3AED?style=flat-square&logo=vitest&logoColor=white" alt="Vitest + Playwright" />
  </p>
</div>

---

**Strata** is an open-source, privacy-first multi-user personal finance PWA (and future native Android app) with an **Expressive Neobank** design, integer-minor financial math (`BIGINT *_minor`), 11 operation types, **Promo Radar**, **NPER Virtual Goal Envelopes**, **Recurring Bills**, and a **2-Way FIFO Debt Ledger**.

## Ключевые возможности

### Умный учёт и точная математика (`@strata/finance-core`)
- **11 типов операций:** `expense`, `income`, `passive_income`, `transfer`, `compensation` (сплит чеков без искажения доходов и расходов), `transit_in` / `transit_out`, а также 4 типа долговых операций (`debt_given`, `debt_received_back`, `debt_borrowed`, `debt_paid_back`).
- **Net Worth vs Safe-to-Spend:** разделение общего капитала (с учётом долгов, вкладов и кредиток) и реально свободного остатка на дебетовых счетах и в наличных за вычетом долга по кредитным картам и неоплаченных регулярных платежей текущего месяца.
- **Быстрый ввод в стиле банковского чека (`N`):** встроенный безопасный калькулятор выражений (`320+185*2`), черновики операций, выбор счёта/категории/цели/долга, смена сторон перевода в 1 тап.
- **Целочисленная точность:** все суммы хранятся и считаются строго в минимальных единицах (`BIGINT *_minor`, копейки/центы) без `float`-ошибок и покрыты едиными `golden-scenarios.json`.

### Планирование и капитал (`/plans` & `/capital`)
- **Виртуальные конверты целей (NPER):** расчёт срока и месяца достижения по формуле `NPER` с учётом эффективной ставки счёта хранения, сохранение баланса цели при промо-перекладках между накопительными счетами, переводы между конвертами без движения реальных денег и учёт распределения по счетам хранения.
- **Промо-радар и доходность:** правила начисления процентов (`daily_balance` / `min_balance`, капитализация), настраиваемое окно предупреждения (`7 / 14 / 30` дней) и 1-клик начисление процентов.
- **Регулярные платежи:** циклы (`weekly` / `monthly` / `quarterly` / `yearly`), ручная отметка, привязанные операции и автозачёт по ключевому слову, поддержка частичных оплат и автоматическое резервирование в `Safe-to-Spend`.
- **2-сторонний реестр долгов (FIFO):** раздельное ведение долгов `Мне должны` (`lent`) и `Я должен` (`borrowed`), детерминированный автозачёт возвратов по FIFO по имени контрагента или прямой привязке, дедлайны и ручное закрытие.

### Интерфейс, приватность и платформа
- **Expressive Neobank UI:** Light / Dark / System темы, 5 акцентных палитр (`emerald`, `ocean`, `amethyst`, `sunset`, `graphite`), глобальный **Privacy Blur** (`tabular-nums` + мягкое размытие всех сумм и графиков), кастомизируемый порядок карточек на обзоре и интерактивный **Spotlight Tour**.
- **Безопасность и Privacy by Design:** строгий Postgres RLS (`(SELECT auth.uid()) = user_id`), 2FA TOTP с автопроверкой кода, управление активными сессиями и их мгновенный отзыв, закрытая регистрация по инвайтам и стелс-админка (`404` для обычных пользователей, только агрегированная телеметрия через `SECURITY DEFINER`).
- **Sync-ready & Экспорт:** клиентские `UUID`, `updated_at`, soft-delete (`deleted_at`), двусторонний Delta Sync (`/api/v1/sync`, `/api/v1/sync/push`) с LWW-конфликтами и выгрузка резервных копий в **JSON v1.0** и **CSV (UTF-8 BOM)**.

---

## Архитектура монорепозитория

| Пакет / каталог | Назначение | Документация |
| :--- | :--- | :--- |
| [`apps/web`](./apps/web) | Next.js 16 App Router (PWA, Tailwind CSS v4, RU/EN, Hono REST API) | [ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
| [`packages/design-tokens`](./packages/design-tokens) | Единые дизайн-токены (`tokens.json` → CSS, JS/TS, Kotlin Compose) | [DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) |
| [`packages/finance-core`](./packages/finance-core) | Чистая финансовая математика + Golden JSON Test Vectors | [DOMAIN_MATH.md](./docs/DOMAIN_MATH.md) |
| [`packages/api-contract`](./packages/api-contract) | Zod v4 схемы и OpenAPI 3.1 контракт для Web и Android | [API_CONTRACT.md](./docs/API_CONTRACT.md) |
| [`supabase/migrations`](./supabase/migrations) | Версионированные SQL-миграции, RLS-политики, триггеры и RPC | [DB_SCHEMA.md](./docs/DB_SCHEMA.md) |

---

## Быстрый старт

### Требования
- Node.js `>= 20` и `npm` (используются `npm workspaces` + Turborepo)
- Проект Supabase (или локальный Supabase CLI)

### Установка и запуск
```bash
git clone https://github.com/S4dK177y/strata.git
cd strata
npm install
npm run build:tokens
```

Создайте `.env.local` в `apps/web` (или в корне для E2E) с переменными Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) и запустите разработку:

```bash
npm run dev
```

### Основные команды
```bash
npm run build:tokens   # Генерация CSS/TS/Kotlin токенов из tokens.json
npm run typecheck      # Проверка типов TypeScript во всех workspace
npm run lint           # ESLint во всех workspace
npm run test           # Юнит-тесты, Golden Math и тесты Hono API (Vitest)
npm run build          # Полная production-сборка через Turborepo
npm run test:e2e       # End-to-End тесты Playwright (360px / 768px / 1280px)
```

Интерактивная документация REST API доступна после запуска по адресу **`/api/docs`** (OpenAPI-спецификация: **`/api/v1/openapi.json`**).

---

## Дорожная карта

- [x] **Stage 1 — Core MVP (PR 1–6.9):** монорепо, SQL + RLS, Hono OpenAPI 3.1 + Delta Sync, Auth + Invite Gate + Онбординг, 11 типов операций + Receipt Quick Add, 2FA TOTP + активные сессии, аналитика обзора, Spotlight Tour, JSON/CSV экспорт, админ-консоль, Expressive Neobank UI полировка.
- [x] **Stage 2 — Smart Planning & Wealth Engine (PR 7–8):** правила доходности, Промо-радар, регулярные платежи, виртуальные конверты целей (NPER + внутренние переводы) и 2-сторонний реестр долгов (FIFO).
- [ ] **Stage 3 — Stories, Yearly Wrapped & Native Android:** лента сторис с админ-редактором, сезонный Yearly Wrapped, публикация/PWA-полировка и нативный Android-клиент на базе `@strata/api-contract` и `StrataTokens.kt`.

Подробный статус разработки ведётся в [`docs/STATUS.md`](./docs/STATUS.md), а история изменений — в [`CHANGELOG.md`](./CHANGELOG.md).

## Лицензия

Распространяется под лицензией [MIT](./LICENSE).
