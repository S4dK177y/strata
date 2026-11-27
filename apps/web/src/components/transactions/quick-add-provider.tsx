"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { Account, Category, Debt, Goal } from "@strata/api-contract";
import { QuickAddDialog, type QuickAddPreset } from "./quick-add-dialog";

interface QuickAddContextValue {
  isOpen: boolean;
  openQuickAdd: (preset?: QuickAddPreset) => void;
  closeQuickAdd: () => void;
  registerOnMutated: (listener: () => void) => () => void;
  setReferenceData: (data: {
    accounts?: Account[];
    categories?: Category[];
    goals?: Goal[];
    debts?: Debt[];
  }) => void;
}

const QuickAddContext = createContext<QuickAddContextValue | null>(null);

export function useQuickAdd() {
  const ctx = useContext(QuickAddContext);
  if (!ctx) {
    throw new Error("useQuickAdd must be used inside QuickAddProvider");
  }
  return ctx;
}

interface QuickAddProviderProps {
  baseCurrency: string;
  initialAccounts?: Account[];
  initialCategories?: Category[];
  initialGoals?: Goal[];
  initialDebts?: Debt[];
  children: ReactNode;
}

export function QuickAddProvider({
  baseCurrency,
  initialAccounts,
  initialCategories,
  initialGoals = [],
  initialDebts = [],
  children,
}: QuickAddProviderProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [openSeq, setOpenSeq] = useState(0);
  const [preset, setPreset] = useState<QuickAddPreset | null>(null);
  const [overrideAccounts, setOverrideAccounts] = useState<Account[] | null>(null);
  const [overrideCategories, setOverrideCategories] = useState<Category[] | null>(null);
  const [overrideGoals, setOverrideGoals] = useState<Goal[] | null>(null);
  const [overrideDebts, setOverrideDebts] = useState<Debt[] | null>(null);
  const listenersRef = useRef(new Set<() => void>());

  const accounts = overrideAccounts ?? initialAccounts ?? [];
  const categories = overrideCategories ?? initialCategories ?? [];
  const goals = overrideGoals ?? initialGoals;
  const debts = overrideDebts ?? initialDebts;
  const isHydrated =
    overrideAccounts !== null ||
    initialAccounts !== undefined ||
    overrideCategories !== null ||
    initialCategories !== undefined;

  const fetchReferenceData = useCallback(async () => {
    try {
      const [accRes, catRes, goalsRes, debtsRes] = await Promise.all([
        fetch("/api/v1/accounts"),
        fetch("/api/v1/categories"),
        fetch("/api/v1/goals"),
        fetch("/api/v1/debts"),
      ]);
      if (accRes.ok) {
        const accJson = (await accRes.json()) as { accounts: Account[] };
        setOverrideAccounts(accJson.accounts);
      }
      if (catRes.ok) {
        const catJson = (await catRes.json()) as { categories: Category[] };
        setOverrideCategories(catJson.categories);
      }
      if (goalsRes.ok) {
        const goalsJson = (await goalsRes.json()) as { goals: Goal[] };
        setOverrideGoals(goalsJson.goals);
      }
      if (debtsRes.ok) {
        const debtsJson = (await debtsRes.json()) as { debts: Debt[] };
        setOverrideDebts(debtsJson.debts);
      }
    } catch {
      // Non-fatal; user still sees current reference state
    }
  }, []);

  const openQuickAdd = useCallback(
    (nextPreset?: QuickAddPreset) => {
      setPreset(nextPreset ?? null);
      setOpenSeq((n) => n + 1);
      setOpen(true);
      if (!isHydrated) {
        void fetchReferenceData();
      }
    },
    [fetchReferenceData, isHydrated]
  );

  const closeQuickAdd = useCallback(() => {
    setOpen(false);
  }, []);

  const registerOnMutated = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const setReferenceData = useCallback(
    (data: {
      accounts?: Account[];
      categories?: Category[];
      goals?: Goal[];
      debts?: Debt[];
    }) => {
      if (data.accounts !== undefined) setOverrideAccounts(data.accounts);
      if (data.categories !== undefined) setOverrideCategories(data.categories);
      if (data.goals !== undefined) setOverrideGoals(data.goals);
      if (data.debts !== undefined) setOverrideDebts(data.debts);
    },
    []
  );

  const handleSuccess = useCallback(() => {
    for (const listener of listenersRef.current) {
      listener();
    }
    router.refresh();
  }, [router]);

  // Global keyboard shortcut: 'N' opens Quick Add when not typing or inside a modal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key !== "n" && e.key !== "N" && e.code !== "KeyN") return;

      const activeEl = document.activeElement;
      if (
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement ||
        (activeEl instanceof HTMLElement && activeEl.isContentEditable)
      ) {
        return;
      }

      if (document.querySelector("dialog[open]")) {
        return;
      }

      e.preventDefault();
      openQuickAdd();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openQuickAdd]);

  const value = useMemo<QuickAddContextValue>(
    () => ({
      isOpen: open,
      openQuickAdd,
      closeQuickAdd,
      registerOnMutated,
      setReferenceData,
    }),
    [open, openQuickAdd, closeQuickAdd, registerOnMutated, setReferenceData]
  );

  return (
    <QuickAddContext.Provider value={value}>
      {children}
      <QuickAddDialog
        open={open}
        openSeq={openSeq}
        onOpenChange={setOpen}
        baseCurrency={baseCurrency}
        accounts={accounts}
        categories={categories}
        goals={goals}
        debts={debts}
        preset={preset}
        onSuccess={handleSuccess}
      />
    </QuickAddContext.Provider>
  );
}
