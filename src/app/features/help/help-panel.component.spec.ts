import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { HelpPanelComponent } from './help-panel.component';

@Component({
  imports: [HelpPanelComponent],
  template: '<div class="content"><app-help-panel /></div>',
})
class HostComponent {}

describe('HelpPanelComponent', () => {
  function setup(url: string) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(AuthService).setUser({
      id: 'u1', name: 'Awa', username: 'awa', role: 'ADMIN', agencyId: 'g1', agencyLabel: 'Siège',
    });
    vi.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue(url);
    const fixture = TestBed.createComponent(HostComponent);
    const element = fixture.nativeElement as HTMLElement;
    const container = element.querySelector<HTMLElement>('.content')!;
    return { fixture, element, container };
  }

  it('renders bold segments without inserted spaces', () => {
    const { fixture, element } = setup('/dashboard');
    fixture.detectChanges();

    const bullet = element.querySelector('#help-demarrer ul li')!;
    expect(bullet.textContent?.trim()).toBe(
      'Ventes du jour, Encaissé aujourd\'hui, Encours clients, Alertes stock : les quatre chiffres du jour.',
    );
  });

  it('scrolls the container to the section of the current url and badges it', async () => {
    const { fixture, element, container } = setup('/invoices');
    // jsdom has no layout: fake the offsets, the container is 0 and the section 420 below.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return { top: this.id === 'help-vente' ? 420 : 0 } as DOMRect;
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(container.scrollTop).toBe(420);
    expect(element.querySelector('#help-vente h3 .badge')?.textContent).toContain('Cet écran');
    expect(element.querySelector('.help-toc .badge')).not.toBeNull();
  });
});
