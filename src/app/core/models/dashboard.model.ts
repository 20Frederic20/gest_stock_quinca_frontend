/**
 * What one agency did today and what is waiting for it. Every figure is counted by the database:
 * none of them is guessed from a page of results.
 */
export interface Dashboard {
  agencyId: string;
  agencyLabel: string;
  /** ISO date of the figures, as the server sees today. */
  date: string;

  /** Final invoices validated today, and their total. */
  invoicesToday: number;
  salesToday: number;

  /** Collected today: everything, then cash alone, for the till. */
  collectedToday: number;
  cashCollectedToday: number;

  /** Documents still in draft, waiting to be finished. */
  draftDocuments: number;
  /**
   * Validated invoices still waiting for a delivery note — none written yet, or only part of the
   * quantity. Their goods are still in stock, reserved for the customer.
   */
  invoicesToDeliver: number;
  /** What the customers of this agency still owe on their credit sales. */
  outstandingTotal: number;
  /** Purchase orders still waiting for their goods. */
  ordersToReceive: number;
  /** Articles whose available quantity fell below their alert threshold. */
  stockAlerts: number;
}
