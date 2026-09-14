export interface Article {
  id: string;
  code: string;
  barcode: string | null;
  designation: string;
  alertThreshold: number;
  vatRate: number;
  active: boolean;
  familyId: string;
  familyLabel: string;
  stockUnitId: string;
  stockUnitCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleRequest {
  code: string;
  barcode: string | null;
  designation: string;
  alertThreshold: number;
  vatRate: number;
  familyId: string;
  stockUnitId: string;
}
