export interface Family {
  id: string;
  label: string;
  displayOrder: number;
  /** null = root family. */
  parentId: string | null;
  parentLabel: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyRequest {
  label: string;
  displayOrder: number;
  parentId: string | null;
}
