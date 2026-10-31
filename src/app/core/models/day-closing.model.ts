/**
 * Une session de caisse d'une agence : fond de caisse déclaré à l'ouverture, puis montant
 * compté et écart calculé à la fermeture.
 */
export interface DayClosing {
  id: string;
  agencyId: string;
  agencyLabel: string;
  /** ISO date, e.g. "2026-09-18". */
  closingDate: string;
  /** "HH:mm:ss". */
  startTime: string;
  endTime: string | null;
  closed: boolean;
  openingCashAmount: number;
  /**
   * Tant que la journée est ouverte, recalculé par le backend à chaque appel (fond de caisse +
   * espèces encaissées depuis l'ouverture) : ce n'est qu'une estimation à l'instant présent.
   * Figé une fois la journée clôturée.
   */
  theoreticalTotal: number;
  countedTotal: number | null;
  /** countedTotal − theoreticalTotal. Nul tant que la journée n'est pas clôturée. */
  variance: number | null;
  comment: string | null;
  openedByUserId: string;
  openedByUserName: string;
  closedByUserId: string | null;
  closedByUserName: string | null;
  createdAt: string;
}

export interface DayClosingOpenRequest {
  openingCashAmount: number;
}

export interface DayClosingCloseRequest {
  countedTotal: number;
  comment: string | null;
}

/** Whether payments can be taken today in an agency, and what to tell the cashier first. */
export interface CashDayStatus {
  open: boolean;
  dayClosingId: string | null;
  /** Local date-time without zone, e.g. "2026-10-31T08:00:00". Null when no day is open. */
  openedAt: string | null;
  /** Open for more than 24 hours. */
  stale: boolean;
  /** Counted total of the last closed day (0 if none): the float proposed for a new day. */
  suggestedOpeningCash: number;
}
