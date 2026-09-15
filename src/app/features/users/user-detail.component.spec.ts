import { TestBed } from '@angular/core/testing';
import { User } from '../../core/models/user.model';
import { UserDetailComponent } from './user-detail.component';

const seller: User = {
  id: 'u2', name: 'Koffi Mensah', username: 'koffi.mensah', role: 'SELLER', discountLimit: 7.5, active: true,
  agencyId: 'g2', agencyLabel: 'Parakou', createdAt: '2026-09-15T08:00:00', updatedAt: '2026-09-16T10:30:00',
};

describe('UserDetailComponent', () => {
  function setup(user: User, isSelf = false) {
    const fixture = TestBed.createComponent(UserDetailComponent);
    fixture.componentRef.setInput('user', user);
    fixture.componentRef.setInput('isSelf', isSelf);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const outputs = { edit: vi.fn(), resetPassword: vi.fn(), toggleActive: vi.fn(), delete: vi.fn() };
    component.edit.subscribe(outputs.edit);
    component.resetPassword.subscribe(outputs.resetPassword);
    component.toggleActive.subscribe(outputs.toggleActive);
    component.delete.subscribe(outputs.delete);

    const element = fixture.nativeElement as HTMLElement;
    const value = (term: string) =>
      [...element.querySelectorAll('dt')].find(dt => dt.textContent?.trim() === term)
        ?.nextElementSibling?.textContent?.trim().replace(/\s+/g, ' ');
    const labels = () => [...element.querySelectorAll('.actions button')].map(b => b.textContent?.trim());
    const button = (label: string) =>
      [...element.querySelectorAll<HTMLElement>('.actions button')].find(b => b.textContent?.trim() === label)!;

    return { outputs, value, labels, button };
  }

  it('shows every field in French', () => {
    const { value } = setup(seller);

    expect(value('Nom')).toBe('Koffi Mensah');
    expect(value('Identifiant')).toBe('koffi.mensah');
    expect(value('Rôle')).toBe('Vendeur');
    expect(value('Agence')).toBe('Parakou');
    expect(value('Remise maximale')).toBe('7,5 %');
    expect(value('État')).toBe('Actif');
    expect(value('Créé le')).toBe('15/09/2026');
    expect(value('Modifié le')).toBe('16/09/2026');
  });

  it('offers every action on another user', () => {
    expect(setup(seller).labels()).toEqual(['Modifier', 'Réinitialiser le mot de passe', 'Désactiver', 'Supprimer']);
    expect(setup({ ...seller, active: false }).labels()).toContain('Activer');
  });

  it('never lets administrators deactivate or delete themselves', () => {
    expect(setup(seller, true).labels()).toEqual(['Modifier', 'Réinitialiser le mot de passe']);
  });

  it('emits the requested action', () => {
    const { outputs, button } = setup(seller);

    button('Modifier').click();
    button('Réinitialiser le mot de passe').click();
    button('Désactiver').click();
    button('Supprimer').click();

    expect(outputs.edit).toHaveBeenCalledTimes(1);
    expect(outputs.resetPassword).toHaveBeenCalledTimes(1);
    expect(outputs.toggleActive).toHaveBeenCalledTimes(1);
    expect(outputs.delete).toHaveBeenCalledTimes(1);
  });
});
