import { TestBed } from '@angular/core/testing';
import { StateViewComponent } from './state-view.component';

describe('StateViewComponent', () => {
  function setup(state: { loading?: boolean; error?: string | null; empty?: boolean }) {
    const fixture = TestBed.createComponent(StateViewComponent);
    fixture.componentRef.setInput('loading', state.loading ?? false);
    fixture.componentRef.setInput('error', state.error ?? null);
    fixture.componentRef.setInput('empty', state.empty ?? false);
    fixture.componentRef.setInput('emptyMessage', 'Aucune unité de mesure enregistrée.');
    fixture.detectChanges();

    const retry = vi.fn();
    fixture.componentInstance.retry.subscribe(retry);

    return { retry, element: fixture.nativeElement as HTMLElement };
  }

  it('shows the loading message first, even when an error is also set', () => {
    const { element } = setup({ loading: true, error: 'Erreur' });

    expect(element.textContent?.trim()).toBe('Chargement…');
  });

  it('shows the error and emits retry when the button is clicked', () => {
    const { element, retry } = setup({ error: 'Le serveur est injoignable.' });

    expect(element.textContent).toContain('Le serveur est injoignable.');
    element.querySelector<HTMLElement>('button')!.click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('shows the empty message when there is nothing to display', () => {
    const { element } = setup({ empty: true });

    expect(element.textContent?.trim()).toBe('Aucune unité de mesure enregistrée.');
  });

  it('renders nothing when data is available', () => {
    const { element } = setup({});

    expect(element.textContent?.trim()).toBe('');
  });
});
