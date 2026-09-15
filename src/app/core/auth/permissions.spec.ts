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

  it('keeps agencies and users for the administrator', () => {
    for (const other of [manager, seller, cashier]) {
      expect(can(other, 'agencies.write')).toBe(false);
      expect(can(other, 'users.manage')).toBe(false);
    }
  });

  it('shows the stock of every agency to a manager, and only their own to sellers and cashiers', () => {
    expect(can(manager, 'stock.view', OTHER)).toBe(true);
    expect(can(manager, 'stock.viewAll')).toBe(true);

    expect(can(seller, 'stock.view', OWN)).toBe(true);
    expect(can(seller, 'stock.view', OTHER)).toBe(false);
    expect(can(cashier, 'stock.viewAll')).toBe(false);
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
