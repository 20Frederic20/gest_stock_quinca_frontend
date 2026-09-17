import { InjectionToken } from '@angular/core';
import { CurrentUser } from '../models/user.model';

/**
 * Switch for the role-based rules in the front.
 * Disabled for now: every logged-in user sees every screen and every action.
 * To enable them again, change the factory to `() => true`.
 */
export const PERMISSIONS_ENABLED = new InjectionToken<boolean>('PERMISSIONS_ENABLED', {
  providedIn: 'root',
  factory: () => false,
});

/**
 * What a user may do. Mirrors the backend rules: the front only hides what would be refused,
 * the backend is the one that actually enforces them.
 */
export type Permission =
  | 'referential.write'
  | 'agencies.write'
  | 'users.manage'
  /** Register a new customer. */
  | 'customers.create'
  /** Edit, activate or deactivate a customer. */
  | 'customers.write'
  | 'customers.delete'
  /** Draft a sale and edit its lines. */
  | 'sales.write'
  /** Cancel a validated document or delete a draft. */
  | 'sales.cancel'
  /** Documents of any agency. */
  | 'sales.viewAll'
  /** Take a payment on an invoice: the till as much as the counter. */
  | 'payments.write'
  /** Cancel a payment already taken. */
  | 'payments.cancel'
  /** Hand the goods of an invoice over to the customer. */
  | 'deliveries.write'
  /** Cancel a delivery note, which brings the goods back into stock. */
  | 'deliveries.cancel'
  /** Register a supplier, change it, activate or deactivate it. */
  | 'suppliers.write'
  /** Order from a supplier and receive the goods: the whole purchasing side. */
  | 'purchases.write'
  | 'suppliers.delete'
  /** Stock of the agency given as `agencyId`. */
  | 'stock.view'
  /** Stock of any agency, e.g. to offer an agency filter. */
  | 'stock.viewAll'
  /** Inventory count or movement reversal in the agency given as `agencyId`. */
  | 'stock.act'
  /** `agencyId` = the requesting agency. */
  | 'transfer.request'
  /** `agencyId` = the agency the stock leaves. */
  | 'transfer.ship'
  /** `agencyId` = the requesting agency, where the stock arrives. */
  | 'transfer.receive';

export function can(user: CurrentUser | null, permission: Permission, agencyId?: string): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;

  const isManager = user.role === 'MANAGER';
  const isOwnAgency = agencyId !== undefined && agencyId === user.agencyId;

  switch (permission) {
    case 'referential.write':
    case 'customers.write':
    case 'suppliers.write':
    case 'purchases.write':
    case 'sales.cancel':
    case 'sales.viewAll':
    case 'stock.viewAll':
      return isManager;
    case 'customers.create':
    case 'sales.write':
      return isManager || user.role === 'SELLER';
    case 'payments.cancel':
    case 'deliveries.cancel':
      return isManager;
    // A cashier holds the till, not the counter: handing the goods over is not theirs.
    case 'deliveries.write':
      return isManager || user.role === 'SELLER';
    // Same as the backend: a cashier takes payments without being allowed to sell.
    case 'payments.write':
      return isManager || user.role === 'SELLER' || user.role === 'CASHIER';
    case 'agencies.write':
    case 'users.manage':
    case 'customers.delete':
    case 'suppliers.delete':
      return false;
    case 'stock.view':
      return isManager || isOwnAgency;
    case 'stock.act':
    case 'transfer.request':
    case 'transfer.ship':
    case 'transfer.receive':
      return isManager && isOwnAgency;
  }
}
