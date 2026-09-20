/** One article in one agency. Quantities are in the article's stock unit. */
export interface AgencyStock {
  id: string;
  articleId: string;
  articleCode: string;
  articleDesignation: string;
  agencyId: string;
  agencyLabel: string;
  stockUnitCode: string;
  /** Physically present. */
  quantity: number;
  /** Already sold, not yet collected by the customer. */
  reservedQuantity: number;
  /** quantity − reservedQuantity: what can still be sold. */
  availableQuantity: number;
  alertThreshold: number;
  /** availableQuantity < alertThreshold. */
  belowThreshold: boolean;
  updatedAt: string;
}

export type MovementType =
  | 'PURCHASE_RECEIPT'
  | 'RETURN'
  | 'TRANSFER_IN'
  | 'SALE'
  | 'TRANSFER_OUT'
  | 'ADJUSTMENT'
  | 'REVERSAL';

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  PURCHASE_RECEIPT: 'Réception fournisseur',
  RETURN: 'Retour client',
  TRANSFER_IN: 'Transfert entrant',
  SALE: 'Vente',
  TRANSFER_OUT: 'Transfert sortant',
  ADJUSTMENT: 'Inventaire',
  REVERSAL: 'Annulation',
};

export interface StockMovement {
  id: string;
  type: MovementType;
  /** Positive for an entry, negative for an exit. */
  quantity: number;
  /** Stock right after this movement. */
  resultingQuantity: number;
  documentType: string | null;
  documentId: string | null;
  reason: string | null;
  movementDate: string;
  /** Set on a reversal: the movement it cancels. */
  reversedMovementId: string | null;
  articleId: string;
  articleDesignation: string;
  agencyId: string;
  agencyLabel: string;
  userId: string;
  userName: string;
}

/**
 * One article's movement summary over a chosen period: the daily stock-movement report's
 * landing view. Only articles that moved at least once in the period are returned.
 */
export interface ArticleMovementStats {
  articleId: string;
  articleCode: string;
  articleDesignation: string;
  unitLabel: string;
  /** Sum of positive movements over the period. */
  totalIn: number;
  /** Sum of negative movements over the period, as a positive number. */
  totalOut: number;
  /** totalIn − totalOut, signed. */
  net: number;
  movementCount: number;
  /** The article's stock right now, shown as a reference point next to the period's totals. */
  currentStock: number;
}

/** Inventory: the counted quantity is typed, the backend computes the difference. The user comes from the session. */
export interface StockAdjustmentRequest {
  articleId: string;
  countedQuantity: number;
  reason: string;
}

export interface ReversalRequest {
  reason: string;
}
