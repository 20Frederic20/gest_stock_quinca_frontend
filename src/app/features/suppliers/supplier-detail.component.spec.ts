import { TestBed } from '@angular/core/testing';
import { Supplier } from '../../core/models/supplier.model';
import { SupplierDetailComponent } from './supplier-detail.component';

const cements: Supplier = {
  id: 'f1', code: 'FOU-001', companyName: 'Ciments du Bénin', address: 'Zone industrielle, Cotonou',
  phone: '+229 21 30 00 00', taxId: '3201900000002', paymentTerms: '30 jours fin de mois', active: true,
  createdAt: '2026-09-15T08:00:00', updatedAt: '2026-09-16T10:30:00',
};

describe('SupplierDetailComponent', () => {
  function setup(supplier: Supplier, canEdit = true, canDelete = true) {
    const fixture = TestBed.createComponent(SupplierDetailComponent);
    fixture.componentRef.setInput('supplier', supplier);
    fixture.componentRef.setInput('canEdit', canEdit);
    fixture.componentRef.setInput('canDelete', canDelete);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const outputs = { edit: vi.fn(), toggleActive: vi.fn(), delete: vi.fn() };
    component.edit.subscribe(outputs.edit);
    component.toggleActive.subscribe(outputs.toggleActive);
    component.delete.subscribe(outputs.delete);

    const element = fixture.nativeElement as HTMLElement;
    const value = (term: string) => {
      const dd = [...element.querySelectorAll('dt')].find(dt => dt.textContent?.trim() === term)?.nextElementSibling;
      return dd?.textContent?.replace(/\s+/g, ' ').trim();
    };
    const labels = () => [...element.querySelectorAll('.actions button')].map(b => b.textContent?.trim());
    const click = (label: string) =>
      [...element.querySelectorAll('.actions button')]
        .find(b => b.textContent?.trim() === label)
        ?.dispatchEvent(new Event('click'));

    return { component, element, value, labels, click, outputs };
  }

  it('shows the whole sheet of the supplier', () => {
    const { value } = setup(cements);

    expect(value('Code')).toBe('FOU-001');
    expect(value('Raison sociale')).toBe('Ciments du Bénin');
    expect(value('Téléphone')).toBe('+229 21 30 00 00');
    expect(value('Adresse')).toBe('Zone industrielle, Cotonou');
    expect(value('IFU')).toBe('3201900000002');
    expect(value('Conditions de règlement')).toBe('30 jours fin de mois');
    expect(value('État')).toContain('Actif');
  });

  it('shows a dash where the supplier gave nothing', () => {
    const { value } = setup({ ...cements, phone: null, address: null, taxId: null, paymentTerms: null });

    expect(value('Téléphone')).toBe('—');
    expect(value('Adresse')).toBe('—');
    expect(value('IFU')).toBe('—');
    expect(value('Conditions de règlement')).toBe('—');
  });

  it('offers to reactivate a supplier no longer used', () => {
    const { labels, value } = setup({ ...cements, active: false });

    expect(value('État')).toContain('Inactif');
    expect(labels()).toEqual(['Modifier', 'Activer', 'Supprimer']);
  });

  it('asks the list to act rather than acting itself', () => {
    const { click, outputs } = setup(cements);

    click('Modifier');
    click('Désactiver');
    click('Supprimer');

    expect(outputs.edit).toHaveBeenCalled();
    expect(outputs.toggleActive).toHaveBeenCalled();
    expect(outputs.delete).toHaveBeenCalled();
  });

  it('offers nothing to someone who may only read', () => {
    const { element } = setup(cements, false, false);

    expect(element.querySelector('.actions')).toBeNull();
  });

  it('keeps the deletion for whoever may delete', () => {
    expect(setup(cements, true, false).labels()).toEqual(['Modifier', 'Désactiver']);
  });
});
