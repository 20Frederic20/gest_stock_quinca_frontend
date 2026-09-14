import { TestBed } from '@angular/core/testing';
import { Packaging } from '../../core/models/packaging.model';
import { PackagingDetailComponent } from './packaging-detail.component';

const pallet: Packaging = {
  id: 'p3', articleId: 'a1', articleDesignation: 'Ciment CIM II 32.5R',
  unitId: 'u3', unitCode: 'PAL', unitLabel: 'Palette', quantity: 1400,
  defaultPurchase: true, defaultSale: false,
  createdAt: '2026-09-13T11:32:32.423855', updatedAt: '2026-09-14T08:05:00',
};

describe('PackagingDetailComponent', () => {
  function setup(packaging: Packaging) {
    const fixture = TestBed.createComponent(PackagingDetailComponent);
    fixture.componentRef.setInput('packaging', packaging);
    fixture.componentRef.setInput('stockUnitCode', 'KG');
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const outputs = { edit: vi.fn(), setDefaultPurchase: vi.fn(), setDefaultSale: vi.fn(), delete: vi.fn() };
    component.edit.subscribe(outputs.edit);
    component.setDefaultPurchase.subscribe(outputs.setDefaultPurchase);
    component.setDefaultSale.subscribe(outputs.setDefaultSale);
    component.delete.subscribe(outputs.delete);

    const element = fixture.nativeElement as HTMLElement;
    const value = (term: string) =>
      [...element.querySelectorAll('dt')].find(dt => dt.textContent?.trim() === term)
        ?.nextElementSibling?.textContent?.trim();
    const button = (label: string) =>
      [...element.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.trim() === label)!;

    return { outputs, value, button };
  }

  it('shows every field, the quantity in the stock unit', () => {
    const { value } = setup(pallet);

    expect(value('Article')).toBe('Ciment CIM II 32.5R');
    expect(value('Unité')).toBe('PAL — Palette');
    // French groups thousands with a narrow no-break space.
    expect(value('Contenance')).toBe('1 400 KG');
    expect(value('Achat')).toBe('Par défaut');
    expect(value('Vente')).toBe('—');
    expect(value('Créé le')).toBe('13/09/2026');
    expect(value('Modifié le')).toBe('14/09/2026');
  });

  it('disables the default action that is already in place', () => {
    const { button } = setup(pallet);

    expect(button('Définir pour l’achat').disabled).toBe(true);
    expect(button('Définir pour la vente').disabled).toBe(false);
  });

  it('emits the requested action', () => {
    const { outputs, button } = setup({ ...pallet, defaultPurchase: false });

    button('Modifier').click();
    button('Définir pour l’achat').click();
    button('Définir pour la vente').click();
    button('Supprimer').click();

    expect(outputs.edit).toHaveBeenCalledTimes(1);
    expect(outputs.setDefaultPurchase).toHaveBeenCalledTimes(1);
    expect(outputs.setDefaultSale).toHaveBeenCalledTimes(1);
    expect(outputs.delete).toHaveBeenCalledTimes(1);
  });
});
