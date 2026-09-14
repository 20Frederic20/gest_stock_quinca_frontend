export interface UnitOfMeasure {
  id: string;
  code: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export interface UnitOfMeasureRequest {
  code: string;
  label: string;
}
