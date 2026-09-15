import { TestBed } from '@angular/core/testing';
import { Customer, CustomerCredit } from '../../core/models/customer.model';
import { formatMoney } from '../pricing/price-rules';
import { CustomerDetailComponent, paymentTermLabel } from './customer-detail.component';

const customer: Customer = {
  id: 'c1', code: 'CLI-001', name: 'Bâtiments Houngbo', type: 'COMPANY', phone: '+229 97 00 00 01', address: null,
  taxId: '3201900000001', creditLimit: 500000, paymentTermDays: 30, comment: null, active: true,
  privilegeId: 'p1', privilegeLabel: 'Standard', createdAt: '2026-09-15T08:00:00', updatedAt: '2026-09-16T10:30:00',
};

const credit: CustomerCredit = {
  customerId: 'c1', customerName: 'Bâtiments Houngbo', creditLimit: 500000, currentBalance: 0,
  remainingCredit: 500000, paymentTermDays: 30, creditAllowed: true,
};

const spaces = (text: string) => text.replace(/\s+/g, ' ');

interface Options {
  credit?: CustomerCredit | null;
  creditLoading?: boolean;
  creditError?: string | null;
  canEdit?: boolean;
  canDelete?: boolean;
}

describe('CustomerDetailComponent', () => {
  function setup(c: Customer, options: Options = {}) {
    const fixture = TestBed.createComponent(CustomerDetailComponent);
    fixture.componentRef.setInput('customer', c);
    fixture.componentRef.setInput('credit', options.credit === undefined ? credit : options.credit);
    fixture.componentRef.setInput('creditLoading', options.creditLoading ?? false);
    fixture.componentRef.setInput('creditError', options.creditError ?? null);
    fixture.componentRef.setInput('canEdit', options.canEdit ?? true);
    fixture.componentRef.setInput('canDelete', options.canDelete ?? true);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const outputs = { edit: vi.fn(), toggleActive: vi.fn(), delete: vi.fn() };
    component.edit.subscribe(outputs.edit);
    component.toggleActive.subscribe(outputs.toggleActive);
    component.delete.subscribe(outputs.delete);

    const element = fixture.nativeElement as HTMLElement;
    const value = (term: string) => {
      const dd = [...element.querySelectorAll('dt')].find(dt => dt.textContent?.trim() === term)?.nextElementSibling;
      return dd ? spaces(dd.textContent ?? '').trim() : undefined;
    };
    const labels = () => [...element.querySelectorAll('.actions button')].map(b => b.textContent?.trim());
    const button = (label: string) =>
      [...element.querySelectorAll<HTMLElement>('.actions button')].find(b => b.textContent?.trim() === label)!;

    return { element, outputs, value, labels, button };
  }

  it('shows every field in French', () => {
    const { value } = setup(customer);

    expect(value('Code')).toBe('CLI-001');
    expect(value('Type')).toBe('Entreprise');
    expect(value('Téléphone')).toBe('+229 97 00 00 01');
    expect(value('Adresse')).toBe('—');
    expect(value('IFU')).toBe('3201900000001');
    expect(value('Grille tarifaire')).toBe('Standard');
    expect(value('État')).toBe('Actif');
    expect(value('Créé le')).toBe('15/09/2026');
  });

  it('shows the credit situation', () => {
    const { value } = setup(customer);

    expect(value('Plafond')).toBe(spaces(formatMoney(500000)));
    expect(value('Encours')).toBe(spaces(formatMoney(0)));
    expect(value('Disponible')).toBe(spaces(formatMoney(500000)));
    expect(value('Délai de règlement')).toBe('30 jours');
    expect(value('Vente à crédit')).toBe('Autorisée');
  });

  it('explains why credit is refused', () => {
    const noLimit = { ...credit, creditLimit: 0, remainingCredit: 0, creditAllowed: false };
    expect(setup(customer, { credit: noLimit }).value('Vente à crédit')).toBe('Non autorisée (plafond à zéro)');

    const inactive = { ...credit, creditAllowed: false };
    expect(setup({ ...customer, active: false }, { credit: inactive }).value('Vente à crédit'))
      .toBe('Non autorisée (client inactif)');
  });

  it('names the payment term', () => {
    expect(paymentTermLabel(0)).toBe('Comptant');
    expect(paymentTermLabel(1)).toBe('1 jour');
    expect(paymentTermLabel(45)).toBe('45 jours');
  });

  it('shows the credit loading and error states instead of the figures', () => {
    expect(setup(customer, { credit: null, creditLoading: true }).element.textContent).toContain('Chargement…');

    const failed = setup(customer, { credit: null, creditError: 'Client introuvable' });
    expect(failed.element.querySelector('.credit-error')?.textContent).toBe('Client introuvable');
    expect(failed.value('Plafond')).toBeUndefined();
  });

  it('offers the actions the user is allowed', () => {
    expect(setup(customer).labels()).toEqual(['Modifier', 'Désactiver', 'Supprimer']);
    expect(setup({ ...customer, active: false }, { canDelete: false }).labels()).toEqual(['Modifier', 'Activer']);

    const readOnly = setup(customer, { canEdit: false, canDelete: false });
    expect(readOnly.element.querySelector('.actions')).toBeNull();
  });

  it('emits the requested action', () => {
    const { outputs, button } = setup(customer);

    button('Modifier').click();
    button('Désactiver').click();
    button('Supprimer').click();

    expect(outputs.edit).toHaveBeenCalledTimes(1);
    expect(outputs.toggleActive).toHaveBeenCalledTimes(1);
    expect(outputs.delete).toHaveBeenCalledTimes(1);
  });
});
