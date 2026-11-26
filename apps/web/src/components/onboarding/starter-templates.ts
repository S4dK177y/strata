import type { AccountType, CategoryKind, Locale } from "@strata/api-contract";

export interface StarterAccountTemplate {
  key: string;
  nameRu: string;
  nameEn: string;
  type: AccountType;
  initialBalanceText: string;
  creditLimitText: string;
  selected: boolean;
}

export interface StarterCategoryTemplate {
  key: string;
  nameRu: string;
  nameEn: string;
  kind: CategoryKind;
  isPassive: boolean;
  selected: boolean;
}

export const SUPPORTED_CURRENCIES = [
  { code: "RUB", labelRu: "RUB — Российский рубль (₽)", labelEn: "RUB — Russian Ruble (₽)" },
  { code: "USD", labelRu: "USD — Доллар США ($)", labelEn: "USD — US Dollar ($)" },
  { code: "EUR", labelRu: "EUR — Евро (€)", labelEn: "EUR — Euro (€)" },
  { code: "KZT", labelRu: "KZT — Казахстанский тенге (₸)", labelEn: "KZT — Kazakhstani Tenge (₸)" },
  { code: "TRY", labelRu: "TRY — Турецкая лира (₺)", labelEn: "TRY — Turkish Lira (₺)" },
  { code: "GBP", labelRu: "GBP — Фунт стерлингов (£)", labelEn: "GBP — British Pound (£)" },
] as const;

export const STARTER_ACCOUNT_TEMPLATES: StarterAccountTemplate[] = [
  {
    key: "main-debit",
    nameRu: "Основная карта",
    nameEn: "Main Checking Card",
    type: "debit",
    initialBalanceText: "0",
    creditLimitText: "0",
    selected: true,
  },
  {
    key: "cash-wallet",
    nameRu: "Наличные",
    nameEn: "Cash Wallet",
    type: "cash",
    initialBalanceText: "0",
    creditLimitText: "0",
    selected: true,
  },
  {
    key: "savings-vault",
    nameRu: "Накопительный счёт",
    nameEn: "Savings Account",
    type: "savings",
    initialBalanceText: "0",
    creditLimitText: "0",
    selected: true,
  },
  {
    key: "credit-card",
    nameRu: "Кредитная карта",
    nameEn: "Credit Card",
    type: "credit",
    initialBalanceText: "0",
    creditLimitText: "0",
    selected: false,
  },
];

export const STARTER_CATEGORY_TEMPLATES: StarterCategoryTemplate[] = [
  { key: "groceries", nameRu: "Продукты", nameEn: "Groceries", kind: "expense", isPassive: false, selected: true },
  { key: "dining", nameRu: "Кафе и рестораны", nameEn: "Dining & Coffee", kind: "expense", isPassive: false, selected: true },
  { key: "transport", nameRu: "Транспорт", nameEn: "Transport", kind: "expense", isPassive: false, selected: true },
  { key: "housing", nameRu: "Жильё и ЖКУ", nameEn: "Housing & Utilities", kind: "expense", isPassive: false, selected: true },
  { key: "subscriptions", nameRu: "Подписки и связь", nameEn: "Subscriptions", kind: "expense", isPassive: false, selected: true },
  { key: "health", nameRu: "Здоровье", nameEn: "Health", kind: "expense", isPassive: false, selected: true },
  { key: "shopping", nameRu: "Покупки и одежда", nameEn: "Shopping", kind: "expense", isPassive: false, selected: false },
  { key: "travel", nameRu: "Путешествия", nameEn: "Travel", kind: "expense", isPassive: false, selected: false },
  { key: "salary", nameRu: "Зарплата", nameEn: "Salary", kind: "income", isPassive: false, selected: true },
  { key: "freelance", nameRu: "Подработка", nameEn: "Freelance", kind: "income", isPassive: false, selected: false },
  { key: "cashback", nameRu: "Кэшбэк", nameEn: "Cashback", kind: "income", isPassive: true, selected: true },
  { key: "interest", nameRu: "Проценты по вкладу", nameEn: "Savings Interest", kind: "income", isPassive: true, selected: true },
];

export function localizeTemplateName(
  item: { nameRu: string; nameEn: string },
  locale: Locale
): string {
  return locale === "en" ? item.nameEn : item.nameRu;
}
