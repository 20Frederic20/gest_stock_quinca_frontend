/** Commercial category. It does not set the prices: the attached privilege does. */
export type CustomerType = 'INDIVIDUAL' | 'COMPANY' | 'RESELLER' | 'PUBLIC_ENTITY';

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  INDIVIDUAL: 'Particulier',
  COMPANY: 'Entreprise',
  RESELLER: 'Revendeur',
  PUBLIC_ENTITY: 'Organisme public',
};

export interface Customer {
  id: string;
  code: string;
  name: string;
  type: CustomerType;
  phone: string | null;
  address: string | null;
  /** IFU (Identifiant Fiscal Unique), unique among customers when given. */
  taxId: string | null;
  /** In XOF. 0 = cash payment only. */
  creditLimit: number;
  /** Days granted to pay a credit invoice, 0 to 365. */
  paymentTermDays: number;
  comment: string | null;
  active: boolean;
  /** Price grid applied to this customer's sales. */
  privilegeId: string;
  privilegeLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerRequest {
  code: string;
  name: string;
  type: CustomerType;
  phone: string | null;
  address: string | null;
  taxId: string | null;
  creditLimit: number;
  paymentTermDays: number;
  comment: string | null;
  privilegeId: string;
}

/** Credit situation at the time of the call. */
export interface CustomerCredit {
  customerId: string;
  customerName: string;
  creditLimit: number;
  /** Unpaid credit invoices. Always 0 until the invoicing module exists on the backend. */
  currentBalance: number;
  remainingCredit: number;
  paymentTermDays: number;
  /** false when the customer is inactive or has no credit limit. */
  creditAllowed: boolean;
}
