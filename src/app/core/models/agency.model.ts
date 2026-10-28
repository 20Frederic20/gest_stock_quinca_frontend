export interface Agency {
  id: string;
  code: string;
  label: string;
  address: string | null;
  phone: string | null;
  /** IFU (Identifiant Fiscal Unique), printed on commercial documents. */
  taxId: string | null;
  /** false = closed agency, kept for the record. */
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgencyRequest {
  code: string;
  label: string;
  address: string | null;
  phone: string | null;
  taxId: string | null;
}
