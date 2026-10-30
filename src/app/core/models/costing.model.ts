export interface CostingStatus {
  started: boolean;
  startedAt: string | null;
  startedByName: string | null;
  missingCostCount: number;
}

/** An opening stock lot whose unit cost the owner fills in. */
export interface InitialCostLine {
  lotId: string;
  articleId: string;
  articleCode: string;
  designation: string;
  familyLabel: string | null;
  stockUnit: string;
  agencyId: string;
  agencyLabel: string;
  quantity: number;
  /** null while still unknown. */
  unitCost: number | null;
}
