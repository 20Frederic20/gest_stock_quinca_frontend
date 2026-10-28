import { TestBed } from '@angular/core/testing';
import { Agency } from '../../core/models/agency.model';
import { AgencyDetailComponent } from './agency-detail.component';

const parakou: Agency = {
  id: 'g2', code: 'PKO', label: 'Parakou', address: null, phone: '+229 23 00 00 00', taxId: null,
  active: true, createdAt: '2026-09-14T19:00:00', updatedAt: '2026-09-15T08:30:00',
};

describe('AgencyDetailComponent', () => {
  function setup(agency: Agency) {
    const fixture = TestBed.createComponent(AgencyDetailComponent);
    fixture.componentRef.setInput('agency', agency);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const outputs = { edit: vi.fn(), toggleActive: vi.fn(), delete: vi.fn() };
    component.edit.subscribe(outputs.edit);
    component.toggleActive.subscribe(outputs.toggleActive);
    component.delete.subscribe(outputs.delete);

    const element = fixture.nativeElement as HTMLElement;
    const value = (term: string) =>
      [...element.querySelectorAll('dt')].find(dt => dt.textContent?.trim() === term)
        ?.nextElementSibling?.textContent?.trim();
    const button = (label: string) =>
      [...element.querySelectorAll<HTMLElement>('button')].find(b => b.textContent?.trim() === label);

    return { outputs, value, button };
  }

  it('shows every field, with a dash for the missing ones', () => {
    const { value } = setup(parakou);

    expect(value('Code')).toBe('PKO');
    expect(value('Libellé')).toBe('Parakou');
    expect(value('Adresse')).toBe('—');
    expect(value('Téléphone')).toBe('+229 23 00 00 00');
    expect(value('IFU')).toBe('—');
    expect(value('État')).toBe('Active');
    expect(value('Créée le')).toBe('14/09/2026');
    expect(value('Modifiée le')).toBe('15/09/2026');
  });

  it('offers to deactivate an active agency, and to activate an inactive one', () => {
    expect(setup(parakou).button('Désactiver')).toBeDefined();

    const inactive = setup({ ...parakou, active: false });
    expect(inactive.value('État')).toBe('Inactive');
    expect(inactive.button('Activer')).toBeDefined();
  });

  it('emits the requested action', () => {
    const { outputs, button } = setup(parakou);

    button('Modifier')!.click();
    button('Désactiver')!.click();
    button('Supprimer')!.click();

    expect(outputs.edit).toHaveBeenCalledTimes(1);
    expect(outputs.toggleActive).toHaveBeenCalledTimes(1);
    expect(outputs.delete).toHaveBeenCalledTimes(1);
  });
});
