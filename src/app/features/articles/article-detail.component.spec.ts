import { TestBed } from '@angular/core/testing';
import { Article } from '../../core/models/article.model';
import { ArticleDetailComponent } from './article-detail.component';

const cement: Article = {
  id: 'a1', code: 'CIM-32R', barcode: null, designation: 'Ciment CIM II 32.5R',
  alertThreshold: 2000, vatRate: 0.18, active: true,
  familyId: 'f2', familyLabel: 'Ciment et liants', stockUnitId: 'u1', stockUnitCode: 'KG',
  createdAt: '2026-09-13T11:32:32.423855', updatedAt: '2026-09-14T08:05:00',
};

describe('ArticleDetailComponent', () => {
  function setup(article: Article) {
    const fixture = TestBed.createComponent(ArticleDetailComponent);
    fixture.componentRef.setInput('article', article);
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

  it('shows every field in French formats', () => {
    const { value } = setup(cement);

    expect(value('Code')).toBe('CIM-32R');
    expect(value('Code-barres')).toBe('—');
    expect(value('Famille')).toBe('Ciment et liants');
    expect(value('Seuil d’alerte')).toBe('2 000 KG');
    expect(value('TVA')).toBe('18 %');
    expect(value('État')).toBe('Actif');
    expect(value('Créé le')).toBe('13/09/2026');
    expect(value('Modifié le')).toBe('14/09/2026');
  });

  it('offers to deactivate an active article, and to activate an inactive one', () => {
    expect(setup(cement).button('Désactiver')).toBeDefined();

    const inactive = setup({ ...cement, active: false });
    expect(inactive.value('État')).toBe('Inactif');
    expect(inactive.button('Activer')).toBeDefined();
  });

  it('emits the requested action', () => {
    const { outputs, button } = setup(cement);

    button('Modifier')!.click();
    button('Désactiver')!.click();
    button('Supprimer')!.click();

    expect(outputs.edit).toHaveBeenCalledTimes(1);
    expect(outputs.toggleActive).toHaveBeenCalledTimes(1);
    expect(outputs.delete).toHaveBeenCalledTimes(1);
  });
});
