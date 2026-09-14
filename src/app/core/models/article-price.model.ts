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
  /** true when this is the price in force today for this privilege. */
  effective: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ArticlePriceRequest {
  privilegeId: string;
  unitPrice: number;
  startDate: string;
}
