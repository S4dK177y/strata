# Strata — Domain Financial Mathematics

All calculations live in `packages/finance-core` and operate on **integer minor units** (`amount_minor > 0`, e.g. `100` = `1.00 ₽`).

## 1. Account Types (5) & Transaction Types (11)
- **Account types:** `debit`, `credit`, `cash`, `savings`, `deposit`
- **Transaction types:**
  1. `income` — active income (adds to `account_from`, counts in `activeIncome`)
  2. `passive_income` — passive income: interest/cashback (adds to `account_from`, counts in `passiveIncome`)
  3. `expense` — expense (subtracts from `account_from`, counts in `grossExpense`)
  4. `compensation` — split/refund (adds to `account_from`, reduces `netExpense` in its category without inflating income)
  5. `transfer` — own-account transfer (subtracts from `account_from`, adds to `account_to`, zero impact on income/expense)
  6. `transit_in` — third-party money in (adds to `account_from`, zero impact on income/expense)
  7. `transit_out` — third-party money out (subtracts from `account_from`, zero impact on income/expense)
  8. `debt_given` — lent money (subtracts from `account_from`, zero impact on income/expense)
  9. `debt_received_back` — borrower repaid me (adds to `account_from`, reduces open `lent` debts)
  10. `debt_borrowed` — I borrowed money (adds to `account_from`, zero impact on income/expense)
  11. `debt_paid_back` — I repaid my debt (subtracts from `account_from`, reduces open `borrowed` debts)

## 2. Core KPIs
- **Net Expense:** `max(0, sum(expense) - sum(compensation))` (computed globally and per-category).
- **Total Income:** `sum(income) + sum(passive_income)`.
- **Net Balance (Saldo):** `Total Income - Net Expense`.
- **Savings Rate:** `Total Income <= 0 ? 0 : Net Balance / Total Income`.
- **Credit Card Debt:** `max(0, -sum(balance of credit accounts))`.
- **Net Worth:** `sum(all account balances) - totalBorrowedRemaining`.
- **Safe-to-Spend:** `sum(debit balances) + sum(cash balances) - unpaidActiveRecurringMinor - creditCardDebt`.

## 3. Savings & Promo Radar
- **Effective Annual Rate:** `promoEndDate >= asOfDate && promoRate > 0 ? promoRate : baseRate`.
- **Monthly Forecast:** `(accrualType === 'min_balance' && minBalanceOverrideMinor != null ? minBalanceOverrideMinor : max(0, balanceMinor)) * effectiveRate / 12`.
- **Annual Forecast:** Splits year into `promoMonths = min(12, daysLeft / 30.4375)` and `baseMonths = 12 - promoMonths`, applying monthly compounding if `capitalization === true` or simple interest otherwise.
- **Portfolio Summary:** `computeSavingsPortfolioSummary` aggregates tracked balances, weighted effective APY, monthly/annual interest totals, and sorts rules by Promo Radar urgency (`expired` → `expiring_soon` → `active` → `base`).

## 3.1 Recurring Payments (`recurring.ts`)
- **Monthly Equivalent Reserve (`cadence`):** `monthly = amountMinor`, `weekly = round(amountMinor * 52 / 12)`, `quarterly = round(amountMinor / 3)`, `yearly = round(amountMinor / 12)`.
- **Period Match Priority (`YYYY-MM`):**
  1. Active manual mark in `recurring_payment_marks` (`paidVia = 'mark'`).
  2. Confirmed active transaction in the same month with `tx.recurringPaymentId === payment.id` (`paidVia = 'transaction'`).
  3. Confirmed active `expense` in the same month whose `tx.comment` contains `payment.matchKeyword` case-insensitively (`paidVia = 'keyword'`).
- **Safe-to-Spend Reserve (`unpaidActiveRecurringMinor`):** Sum of `monthlyEquivalentMinor` across all active (`isActive = true`) unpaid payments in the current month.
- **Feb / Short-Month Clamping:** `dueDate` clamps `dayOfMonth` to `getDaysInMonth(year, month)`.

## 4. Virtual Goal Envelopes (`NPER`)
- **Transaction flow into goal (`goalId`):**
  - `expense` → `-amount`
  - `income` / `passive_income` → `+amount`
  - `transfer` → `+amount` if entering savings/deposit from non-savings; `-amount` if leaving savings/deposit to non-savings; `0` when moving between two savings/deposit accounts (preserves envelopes during promo-rate hopping!).
- **Total in envelope:** `max(0, initialAmount + txFlow + netGoalTransfers)`.
- **NPER (months to goal):** if `monthlyRate = effectiveRate / 12 > 0`, `ceil(ln((pmt + fv * r) / (pmt + pv * r)) / ln(1 + r))`; else `ceil((fv - pv) / pmt)`.

## 5. 2-Way Debt Ledger (FIFO)
- Strictly separates `lent` (repaid by `debt_received_back`) and `borrowed` (repaid by `debt_paid_back`).
- Matches directly by `tx.debtId`, with FIFO fallback by `counterparty` substring match in `tx.comment` for Android push / manual transactions without `debtId`.

## 6. Yearly Wrapped
- Financial titles (6 tiers by `totalIncome` & `savingsRate`), top 5 categories, calendar extremes, max purchase in work hours, passive income equivalents (coffee, shawarma, subscriptions), discipline rank, favorite card, cost of 1 day of life, Anti-fuckup filtered volume (`transfer + transit_in + transit_out + all 4 debt types + 2 * compensation`), autonomy months, and 2-way Debt Hall of Fame.
