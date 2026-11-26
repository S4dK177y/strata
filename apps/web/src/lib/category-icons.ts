import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  Briefcase,
  Car,
  Coffee,
  Coins,
  CreditCard,
  Dumbbell,
  Film,
  Gamepad2,
  Gift,
  GraduationCap,
  Handshake,
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
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Tag,
  TrendingDown,
  TrendingUp,
  Undo2,
  Utensils,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { AccountType, TransactionType } from "@strata/api-contract";

export const CATEGORY_ICON_LIST = [
  { key: "shopping-cart", icon: ShoppingCart },
  { key: "utensils", icon: Utensils },
  { key: "coffee", icon: Coffee },
  { key: "car", icon: Car },
  { key: "home", icon: Home },
  { key: "smartphone", icon: Smartphone },
  { key: "heart-pulse", icon: HeartPulse },
  { key: "shopping-bag", icon: ShoppingBag },
  { key: "plane", icon: Plane },
  { key: "briefcase", icon: Briefcase },
  { key: "laptop", icon: Laptop },
  { key: "percent", icon: Percent },
  { key: "landmark", icon: Landmark },
  { key: "gift", icon: Gift },
  { key: "graduation-cap", icon: GraduationCap },
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

export function getCategoryIcon(iconKey: string | null | undefined): LucideIcon {
  if (!iconKey) return Tag;
  return CATEGORY_ICON_MAP.get(iconKey) ?? Tag;
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
