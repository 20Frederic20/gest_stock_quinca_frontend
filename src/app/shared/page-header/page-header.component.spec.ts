import { TestBed } from '@angular/core/testing';
import { PageHeaderComponent } from './page-header.component';

describe('PageHeaderComponent', () => {
  function setup(actionLabel: string) {
    const fixture = TestBed.createComponent(PageHeaderComponent);
    fixture.componentRef.setInput('heading', 'Unités de mesure');
    fixture.componentRef.setInput('actionLabel', actionLabel);
    fixture.detectChanges();

    const action = vi.fn();
    fixture.componentInstance.action.subscribe(action);

    return { action, element: fixture.nativeElement as HTMLElement };
  }

  it('shows the heading', () => {
    const { element } = setup('');

    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Unités de mesure');
  });

  it('hides the action button when no label is given', () => {
    const { element } = setup('');

    expect(element.querySelector('button')).toBeNull();
  });

  it('emits action when the button is clicked', () => {
    const { action, element } = setup('Nouvelle unité');

    element.querySelector<HTMLElement>('button')!.click();

    expect(action).toHaveBeenCalledTimes(1);
  });
});
