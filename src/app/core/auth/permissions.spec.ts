import { CurrentUser, Role } from '../models/user.model';
import { can } from './permissions';

const OWN = 'cotonou';
const OTHER = 'parakou';

const user = (role: Role): CurrentUser => ({
  id: 'u1', name: 'Test', username: 'test', role, agencyId: OWN, agencyLabel: 'Cotonou — Siège',
});

const admin = user('ADMIN');
const manager = user('MANAGER');
const seller = user('SELLER');
const cashier = user('CASHIER');

describe('can', () => {
  it('refuses everything to an anonymous visitor', () => {
    expect(can(null, 'referential.write')).toBe(false);
    expect(can(null, 'stock.view', OWN)).toBe(false);
  });

  it('lets an administrator do everything, in every agency', () => {
    expect(can(admin, 'users.manage')).toBe(true);
    expect(can(admin, 'agencies.write')).toBe(true);
    expect(can(admin, 'stock.act', OTHER)).toBe(true);
    expect(can(admin, 'transfer.ship', OTHER)).toBe(true);
  });

  it('lets a manager and an administrator edit the referential, not the others', () => {
    expect(can(manager, 'referential.write')).toBe(true);
    expect(can(seller, 'referential.write')).toBe(false);
    expect(can(cashier, 'referential.write')).toBe(false);
  });

  it('lets everyone who sells or holds the till take a payment', () => {
    expect(can(manager, 'payments.write')).toBe(true);
    expect(can(seller, 'payments.write')).toBe(true);
    expect(can(cashier, 'payments.write')).toBe(true);
  });

  it('keeps the cancellation of a payment for a manager or an administrator', () => {
    expect(can(manager, 'payments.cancel')).toBe(true);
    expect(can(seller, 'payments.cancel')).toBe(false);
    expect(can(cashier, 'payments.cancel')).toBe(false);
  });

  it('lets whoever sells hand the goods over, but not the cashier', () => {
    expect(can(manager, 'deliveries.write')).toBe(true);
    expect(can(seller, 'deliveries.write')).toBe(true);
    expect(can(cashier, 'deliveries.write')).toBe(false);
  });

  it('keeps the cancellation of a delivery note for a manager or an administrator', () => {
    expect(can(manager, 'deliveries.cancel')).toBe(true);
    expect(can(seller, 'deliveries.cancel')).toBe(false);
  });

  it('lets a manager keep the suppliers, but only an administrator remove one', () => {
    expect(can(manager, 'suppliers.write')).toBe(true);
    expect(can(seller, 'suppliers.write')).toBe(false);
    expect(can(admin, 'suppliers.delete')).toBe(true);
    expect(can(manager, 'suppliers.delete')).toBe(false);
  });

  it('keeps the purchases for a manager or an administrator', () => {
    expect(can(manager, 'purchases.write')).toBe(true);
    expect(can(seller, 'purchases.write')).toBe(false);
    expect(can(cashier, 'purchases.write')).toBe(false);
  });

  it('keeps agencies and users for the administrator', () => {
    for (const other of [manager, seller, cashier]) {
      expect(can(other, 'agencies.write')).toBe(false);
      expect(can(other, 'users.manage')).toBe(false);
    }
  });

  it('lets sellers register customers, managers change them, and only administrators delete them', () => {
    expect(can(seller, 'customers.create')).toBe(true);
    expect(can(manager, 'customers.create')).toBe(true);
    expect(can(cashier, 'customers.create')).toBe(false);

    expect(can(manager, 'customers.write')).toBe(true);
    expect(can(seller, 'customers.write')).toBe(false);

    expect(can(manager, 'customers.delete')).toBe(false);
    expect(can(admin, 'customers.delete')).toBe(true);
  });

  it('lets sellers draft sales, and keeps cancellations for managers', () => {
    expect(can(seller, 'sales.write')).toBe(true);
    expect(can(cashier, 'sales.write')).toBe(false);

    expect(can(manager, 'sales.cancel')).toBe(true);
    expect(can(seller, 'sales.cancel')).toBe(false);
  });

  it('never shows sale documents of another agency, not even to a manager', () => {
    expect(can(manager, 'sales.viewAll')).toBe(false);
    expect(can(seller, 'sales.viewAll')).toBe(false);
    expect(can(admin, 'sales.viewAll')).toBe(true);
  });

  it('shows the stock of every agency to every role, e.g. through the navbar switcher', () => {
    expect(can(manager, 'stock.view', OTHER)).toBe(true);
    expect(can(manager, 'stock.viewAll')).toBe(true);

    expect(can(seller, 'stock.view', OWN)).toBe(true);
    expect(can(seller, 'stock.view', OTHER)).toBe(true);
    expect(can(seller, 'stock.viewAll')).toBe(true);

    expect(can(cashier, 'stock.view', OTHER)).toBe(true);
    expect(can(cashier, 'stock.viewAll')).toBe(true);
  });

  it('lets a manager count or reverse stock only in their own agency', () => {
    expect(can(manager, 'stock.act', OWN)).toBe(true);
    expect(can(manager, 'stock.act', OTHER)).toBe(false);
    expect(can(seller, 'stock.act', OWN)).toBe(false);
  });

  it('lets a manager request stock for their agency, and ship only from it', () => {
    expect(can(manager, 'transfer.request', OWN)).toBe(true);
    expect(can(manager, 'transfer.request', OTHER)).toBe(false);

    expect(can(manager, 'transfer.ship', OWN)).toBe(true);
    expect(can(manager, 'transfer.ship', OTHER)).toBe(false);

    expect(can(manager, 'transfer.receive', OWN)).toBe(true);
    expect(can(manager, 'transfer.receive', OTHER)).toBe(false);
  });

  it('refuses an agency-bound action when no agency is given', () => {
    expect(can(manager, 'stock.act')).toBe(false);
  });
});
