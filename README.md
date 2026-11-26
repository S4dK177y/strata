# Strata (Страта)

**Strata** — open-source, privacy-first мультипользовательский трекер личных финансов (PWA + будущий нативный Android) в стиле выразительного необанка.

**Strata** is an open-source, privacy-first multi-user personal finance PWA (and future native Android app) with an expressive neobank design, exact double-free cashflow math, promo-rate radar, virtual goal envelopes (`NPER`), 2-way debt ledger, and seasonal Stories Wrapped.

## Ключевые возможности / Key Features
- **11 типов операций / 11 Transaction Types**: расходы, трудовой и пассивный доход, переводы между своими счетами, компенсации (сплит чеков без раздувания расходов), транзиты и 4-сторонний учёт долгов.
- **Net Worth vs Safe-to-Spend**: точное разделение общего капитала и суммы, реально свободной к трате после обязательных платежей и долга по кредитке.
- **Виртуальные конверты целей (NPER)** & **Радар промо-ставок** по накопительным счетам и вкладам.
- **Stories Engine & Сезонный Wrapped**: облачные Feature Flags, редактор сторис с фото/видео/аудио в `/admin`, годовой Wrapped и экспорт карточки без сумм.
- **Privacy by Design**: строгий Postgres RLS на каждого пользователя, режим приватности (Blur), закрытая регистрация по инвайтам по умолчанию.
- **Sync-ready с 1-го дня**: целочисленная денежная математика в копейках/центах (`BIGINT`), клиентские `UUID`, `updated_at`, `deleted_at`, черновики для будущего парсера пушей на Android.

## Monorepo Layout
- `apps/web` — Next.js App Router (PWA, Tailwind CSS v4, RU/EN, REST API)
- `packages/design-tokens` — Единые дизайн-токены (`tokens.json` → CSS + Kotlin Compose)
- `packages/finance-core` — Чистая финансовая математика + Golden JSON Test Vectors
- `packages/api-contract` — Единые Zod-схемы и OpenAPI 3.1 контракт

## Quick Start
```bash
npm install
npm run build:tokens
npm run typecheck
npm run test
npm run dev
```
