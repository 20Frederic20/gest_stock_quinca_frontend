export interface ArticlePrice {
  id: string;
  packagingId: string;
  articleId: string;
  articleDesignation: string;
  packagingUnitCode: string;
  packagingQuantity: number;
  privilegeId: string;
  privilegeLabel: string;
  unitPrice: number;
  /** ISO format, e.g. "2026-09-14". */
  startDate: string;
  /**
   * true once the start date is reached: the price is then locked (no edit, no deletion).
   * It is not "the price applied today": an older price replaced by a newer one is effective too.
   */
  effective: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ArticlePriceRequest {
  privilegeId: string;
  unitPrice: number;
  startDate: string;
}
