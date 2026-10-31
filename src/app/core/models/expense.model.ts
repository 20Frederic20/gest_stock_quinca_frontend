/** Mirrors the backend ExpenseResponse. Dates are ISO strings, amounts are numbers. */
export interface Expense {
  id: string;
  expenseDate: string;
  categoryId: string;
  categoryLabel: string;
  /** null = charge common to all agencies. */
  agencyId: string | null;
  agencyLabel: string | null;
  label: string;
  amount: number;
  note: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  /** Whether the current user may edit or delete it. */
  editable: boolean;
}

/** Mirrors the backend ExpenseRequest. */
export interface ExpenseRequest {
  expenseDate: string;
  categoryId: string;
  /** Omitted or null = common charge (owner only). */
  agencyId?: string | null;
  label: string;
  amount: number;
  note?: string | null;
}

export interface ExpenseCategory {
  id: string;
  label: string;
  description: string | null;
  active: boolean;
}

export interface ExpenseCategoryRequest {
  label: string;
  description?: string | null;
}
