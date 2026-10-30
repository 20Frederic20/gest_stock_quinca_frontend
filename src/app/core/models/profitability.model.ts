/** Mirrors the backend ProfitabilityReport. Rates are fractions (0.285), shown as % by the screens. */
export interface ProfitabilityReport {
  from: string;
  to: string;
  agencyId: string | null;
  agencyLabel: string | null;
  trackingStartedAt: string | null;
  beforeStart: boolean;
  families: ProfitabilityFamilyRow[];
  transportBilled: number;
  cancelledRevenue: number;
  cancelledCost: number;
  transferLosses: number;
  inventoryGains: number;
  inventoryLosses: number;
  revenue: number;
  cost: number;
  margin: number;
  marginRate: number | null;
  expenses: ProfitabilityExpenseBlock;
  netProfit: number;
  missingCostArticles: ProfitabilityMissingCostArticle[];
  salesWithMissingCost: number;
}

export interface ProfitabilityFamilyRow {
  familyId: string;
  label: string;
  revenue: number;
  cost: number;
  margin: number;
  marginRate: number | null;
  articles: ProfitabilityArticleRow[];
}

export interface ProfitabilityArticleRow {
  articleId: string;
  code: string;
  designation: string;
  stockUnit: string;
  quantitySold: number;
  averageSalePrice: number | null;
  averagePurchasePrice: number | null;
  revenue: number;
  cost: number;
  margin: number;
  marginRate: number | null;
  /** Part of the quantity sold has no known cost. */
  missingCost: boolean;
}

export interface ProfitabilityExpenseBlock {
  common: ProfitabilityCategoryTotal[];
  commonTotal: number;
  /** true: common charges are shown for information and not included in `total`. */
  commonInformative: boolean;
  byAgency: ProfitabilityAgencyExpenses[];
  total: number;
}

export interface ProfitabilityCategoryTotal {
  categoryId: string;
  label: string;
  amount: number;
}

export interface ProfitabilityAgencyExpenses {
  agencyId: string;
  label: string;
  categories: ProfitabilityCategoryTotal[];
  total: number;
}

/** Remaining stock with no unit cost (open lot without cost). */
export interface ProfitabilityMissingCostArticle {
  articleId: string;
  designation: string;
  agencyId: string;
  agencyLabel: string;
  quantity: number;
}
