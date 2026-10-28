export interface Packaging {
  id: string;
  articleId: string;
  articleDesignation: string;
  unitId: string;
  unitCode: string;
  unitLabel: string;
  quantity: number;
  defaultPurchase: boolean;
  defaultSale: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PackagingRequest {
  unitId: string;
  quantity: number;
  defaultPurchase: boolean;
  defaultSale: boolean;
}
