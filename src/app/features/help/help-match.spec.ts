import { HELP_SECTIONS } from './help-content';
import { sectionForUrl, sectionsForRole } from './help-match';

const ids = (role: Parameters<typeof sectionsForRole>[0]) => sectionsForRole(role, HELP_SECTIONS).map(s => s.id);

describe('sectionsForRole', () => {
  it('gives a seller the sales sections and nothing about purchases or administration', () => {
    const seller = ids('SELLER');
    expect(seller).toEqual(expect.arrayContaining(['vente', 'encaisser', 'livrer', 'referentiel-consulter']));
    for (const hidden of ['achats', 'inventaire', 'transferts', 'referentiel', 'depenses', 'reprise', 'rentabilite', 'administration', 'caisse']) {
      expect(seller).not.toContain(hidden);
    }
  });

  it('gives a cashier the till and the payments but not the sales', () => {
    const cashier = ids('CASHIER');
    expect(cashier).toEqual(expect.arrayContaining(['caisse', 'encaisser']));
    expect(cashier).not.toContain('vente');
  });

  it('gives an administrator the costs, profitability and administration, and no limits', () => {
    const admin = ids('ADMIN');
    expect(admin).toEqual(expect.arrayContaining(['reprise', 'rentabilite', 'administration']));
    expect(admin).not.toContain('referentiel-consulter');
    expect(admin).not.toContain('limites');
  });

  it('keeps only the limits of the role', () => {
    const limits = sectionsForRole('CASHIER', HELP_SECTIONS).find(s => s.id === 'limites')!;
    const text = JSON.stringify(limits.blocks);
    expect(text).toContain('Créer une vente ou livrer.');
    expect(text).not.toContain('remise maximale');
    expect(text).not.toContain('role-bullets');
  });
});

describe('sectionForUrl', () => {
  const seller = sectionsForRole('SELLER', HELP_SECTIONS);

  it('opens the sale section on the invoice list', () => {
    expect(sectionForUrl(seller, '/invoices')?.id).toBe('vente');
    expect(sectionForUrl(seller, '/invoices?status=DRAFT')?.id).toBe('vente');
  });

  it('opens "livrer" on an invoice page, the longer prefix', () => {
    expect(sectionForUrl(seller, '/invoices/123')?.id).toBe('livrer');
  });

  it('opens the till for the day closing', () => {
    expect(sectionForUrl(sectionsForRole('CASHIER', HELP_SECTIONS), '/day-closing')?.id).toBe('caisse');
  });

  it('only considers the sections of the role', () => {
    expect(sectionForUrl(seller, '/day-closing')?.id).toBe('demarrer');
  });

  it('falls back to the first section on an unknown url', () => {
    expect(sectionForUrl(seller, '/nowhere')?.id).toBe(seller[0].id);
  });
});
