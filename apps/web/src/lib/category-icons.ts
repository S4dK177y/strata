import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Baby,
  Banknote,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  Car,
  Coffee,
  Coins,
  CreditCard,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  Handshake,
  Heart,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  Music,
  PawPrint,
  Percent,
  PiggyBank,
  Plane,
  RotateCcw,
  Scissors,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Stethoscope,
  Tag,
  TrainFront,
  TrendingDown,
  TrendingUp,
  Undo2,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { AccountType, TransactionType } from "@strata/api-contract";

export const CATEGORY_ICON_LIST = [
  { key: "shopping-cart", icon: ShoppingCart },
  { key: "utensils", icon: Utensils },
  { key: "coffee", icon: Coffee },
  { key: "car", icon: Car },
  { key: "bus", icon: Bus },
  { key: "train-front", icon: TrainFront },
  { key: "fuel", icon: Fuel },
  { key: "home", icon: Home },
  { key: "building-2", icon: Building2 },
  { key: "zap", icon: Zap },
  { key: "wifi", icon: Wifi },
  { key: "smartphone", icon: Smartphone },
  { key: "heart-pulse", icon: HeartPulse },
  { key: "stethoscope", icon: Stethoscope },
  { key: "heart", icon: Heart },
  { key: "shopping-bag", icon: ShoppingBag },
  { key: "scissors", icon: Scissors },
  { key: "plane", icon: Plane },
  { key: "briefcase", icon: Briefcase },
  { key: "laptop", icon: Laptop },
  { key: "percent", icon: Percent },
  { key: "landmark", icon: Landmark },
  { key: "shield", icon: Shield },
  { key: "gift", icon: Gift },
  { key: "graduation-cap", icon: GraduationCap },
  { key: "book-open", icon: BookOpen },
  { key: "baby", icon: Baby },
  { key: "gamepad-2", icon: Gamepad2 },
  { key: "dumbbell", icon: Dumbbell },
  { key: "paw-print", icon: PawPrint },
  { key: "wrench", icon: Wrench },
  { key: "music", icon: Music },
  { key: "film", icon: Film },
  { key: "wallet", icon: Wallet },
  { key: "coins", icon: Coins },
  { key: "tag", icon: Tag },
] as const satisfies ReadonlyArray<{ key: string; icon: LucideIcon }>;

const CATEGORY_ICON_MAP = new Map<string, LucideIcon>(
  CATEGORY_ICON_LIST.map((item) => [item.key, item.icon])
);

const CATEGORY_KEYWORD_ICONS: ReadonlyArray<{ keywords: readonly string[]; iconKey: string }> = [
  { keywords: ["продукт", "супермарк", "магазин", "еда", "grocer", "supermarket"], iconKey: "shopping-cart" },
  { keywords: ["кафе", "ресторан", "доставка ед", "обед", "ужин", "dining", "restaurant", "food"], iconKey: "utensils" },
  { keywords: ["кофе", "кофейн", "чай", "coffee"], iconKey: "coffee" },
  { keywords: ["топлив", "бензин", "азс", "заправ", "fuel", "gas"], iconKey: "fuel" },
  { keywords: ["автобус", "метро", "обществен", "bus", "transit"], iconKey: "bus" },
  { keywords: ["поезд", "электрич", "ржд", "train"], iconKey: "train-front" },
  { keywords: ["транспорт", "такси", "авто", "машин", "парков", "transport", "taxi", "uber", "car"], iconKey: "car" },
  { keywords: ["интернет", "wifi", "wi-fi", "роутер", "internet"], iconKey: "wifi" },
  { keywords: ["электр", "свет", "энерг", "electric", "utility"], iconKey: "zap" },
  { keywords: ["жиль", "жку", "аренд", "коммунал", "кварт", "дом", "housing", "rent", "home"], iconKey: "home" },
  { keywords: ["подпис", "связ", "телефон", "мобиль", "сотов", "subscrip", "mobile", "phone"], iconKey: "smartphone" },
  { keywords: ["здоров", "аптек", "лекар", "клиник", "медиц", "health", "pharmacy", "medic"], iconKey: "heart-pulse" },
  { keywords: ["врач", "стоматолог", "анализ", "doctor", "dentist"], iconKey: "stethoscope" },
  { keywords: ["красот", "стриж", "салон", "барбер", "уход", "beauty", "salon", "hair"], iconKey: "scissors" },
  { keywords: ["покуп", "одежд", "обув", "маркет", "озон", "вайлдбер", "wb", "shopping", "cloth"], iconKey: "shopping-bag" },
  { keywords: ["путешест", "отпуск", "билет", "отель", "перелет", "авиа", "travel", "flight", "hotel"], iconKey: "plane" },
  { keywords: ["зарплат", "оклад", "аванс", "работ", "salary", "payroll"], iconKey: "briefcase" },
  { keywords: ["подработ", "фриланс", "проект", "it", "софт", "freelance", "software"], iconKey: "laptop" },
  { keywords: ["кэшбэк", "кешбэк", "cashback", "бонус"], iconKey: "percent" },
  { keywords: ["процент", "вклад", "дивиденд", "инвест", "накоп", "interest", "dividend", "bank"], iconKey: "landmark" },
  { keywords: ["страхов", "налог", "штраф", "insurance", "tax"], iconKey: "shield" },
  { keywords: ["подар", "цвет", "праздник", "gift"], iconKey: "gift" },
  { keywords: ["спорт", "фитнес", "зал", "трениров", "sport", "gym", "fitness"], iconKey: "dumbbell" },
  { keywords: ["учеб", "образован", "курс", "универ", "education", "course"], iconKey: "graduation-cap" },
  { keywords: ["книг", "book"], iconKey: "book-open" },
  { keywords: ["дет", "ребен", "ребён", "садик", "baby", "kids"], iconKey: "baby" },
  { keywords: ["игр", "steam", "ps", "развлеч", "game", "entertainment"], iconKey: "gamepad-2" },
  { keywords: ["животн", "питом", "кот", "собак", "корм", "pet", "vet"], iconKey: "paw-print" },
  { keywords: ["ремонт", "инструм", "строит", "repair", "tools"], iconKey: "wrench" },
  { keywords: ["музык", "спотифай", "яндекс музык", "music"], iconKey: "music" },
  { keywords: ["кино", "театр", "фильм", "movie", "cinema"], iconKey: "film" },
];

export function inferCategoryIconKey(categoryName: string | null | undefined): string | null {
  if (!categoryName) return null;
  const lower = categoryName.trim().toLowerCase();
  if (!lower) return null;
  for (const entry of CATEGORY_KEYWORD_ICONS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.iconKey;
    }
  }
  return null;
}

export function getCategoryIcon(
  iconKey: string | null | undefined,
  categoryName?: string | null
): LucideIcon {
  if (iconKey && CATEGORY_ICON_MAP.has(iconKey)) {
    return CATEGORY_ICON_MAP.get(iconKey)!;
  }
  const inferred = inferCategoryIconKey(categoryName);
  if (inferred && CATEGORY_ICON_MAP.has(inferred)) {
    return CATEGORY_ICON_MAP.get(inferred)!;
  }
  return Tag;
}

export const ACCOUNT_TYPE_ICONS: Record<AccountType, LucideIcon> = {
  debit: CreditCard,
  credit: CreditCard,
  cash: Banknote,
  savings: PiggyBank,
  deposit: Landmark,
};

export interface TransactionTypeMeta {
  group: "primary" | "extended";
  icon: LucideIcon;
  colorVar: string;
  sign: "+" | "-" | "";
  accountDirection: "out" | "in" | "transfer";
  categoryFilter: "expense" | "income_active" | "income_passive" | null;
}

export const PRIMARY_TRANSACTION_TYPES: readonly TransactionType[] = [
  "expense",
  "income",
  "transfer",
];

export const EXTENDED_TRANSACTION_TYPES: readonly TransactionType[] = [
  "compensation",
  "passive_income",
  "transit_in",
  "transit_out",
  "debt_given",
  "debt_received_back",
  "debt_borrowed",
  "debt_paid_back",
];

export const ALL_TRANSACTION_TYPES: readonly TransactionType[] = [
  ...PRIMARY_TRANSACTION_TYPES,
  ...EXTENDED_TRANSACTION_TYPES,
];

export const TRANSACTION_TYPE_META: Record<TransactionType, TransactionTypeMeta> = {
  expense: {
    group: "primary",
    icon: TrendingDown,
    colorVar: "var(--strata-money-expense)",
    sign: "-",
    accountDirection: "out",
    categoryFilter: "expense",
  },
  income: {
    group: "primary",
    icon: TrendingUp,
    colorVar: "var(--strata-money-income)",
    sign: "+",
    accountDirection: "in",
    categoryFilter: "income_active",
  },
  transfer: {
    group: "primary",
    icon: ArrowLeftRight,
    colorVar: "var(--strata-text-primary)",
    sign: "",
    accountDirection: "transfer",
    categoryFilter: null,
  },
  compensation: {
    group: "extended",
    icon: RotateCcw,
    colorVar: "var(--strata-money-compensation)",
    sign: "+",
    accountDirection: "in",
    categoryFilter: "expense",
  },
  passive_income: {
    group: "extended",
    icon: Percent,
    colorVar: "var(--strata-money-income)",
    sign: "+",
    accountDirection: "in",
    categoryFilter: "income_passive",
  },
  transit_in: {
    group: "extended",
    icon: ArrowDownLeft,
    colorVar: "var(--strata-text-secondary)",
    sign: "+",
    accountDirection: "in",
    categoryFilter: null,
  },
  transit_out: {
    group: "extended",
    icon: ArrowUpRight,
    colorVar: "var(--strata-text-secondary)",
    sign: "-",
    accountDirection: "out",
    categoryFilter: null,
  },
  debt_given: {
    group: "extended",
    icon: Handshake,
    colorVar: "var(--strata-debt-lent)",
    sign: "-",
    accountDirection: "out",
    categoryFilter: null,
  },
  debt_received_back: {
    group: "extended",
    icon: Undo2,
    colorVar: "var(--strata-debt-lent)",
    sign: "+",
    accountDirection: "in",
    categoryFilter: null,
  },
  debt_borrowed: {
    group: "extended",
    icon: ArrowDownLeft,
    colorVar: "var(--strata-debt-borrowed)",
    sign: "+",
    accountDirection: "in",
    categoryFilter: null,
  },
  debt_paid_back: {
    group: "extended",
    icon: ArrowUpRight,
    colorVar: "var(--strata-debt-borrowed)",
    sign: "-",
    accountDirection: "out",
    categoryFilter: null,
  },
};
