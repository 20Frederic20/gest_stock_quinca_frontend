/** A company the shop buys from. Its code and its IFU are unique among suppliers. */
export interface Supplier {
  id: string;
  code: string;
  companyName: string;
  address: string | null;
  phone: string | null;
  /** IFU (Identifiant Fiscal Unique), unique among suppliers when given. */
  taxId: string | null;
  /** Free text: "30 jours fin de mois", "comptant à la livraison"… */
  paymentTerms: string | null;
  /** false = supplier no longer used, kept for the record. */
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierRequest {
  code: string;
  companyName: string;
  address: string | null;
  phone: string | null;
  taxId: string | null;
  paymentTerms: string | null;
}
