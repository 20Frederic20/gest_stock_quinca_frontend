import { TestBed } from '@angular/core/testing';
import { DrawerComponent } from './drawer.component';

describe('DrawerComponent', () => {
  function setup(open: boolean) {
    const fixture = TestBed.createComponent(DrawerComponent);
    fixture.componentRef.setInput('open', open);
    fixture.componentRef.setInput('heading', 'Nouvelle unité');
    fixture.detectChanges();

    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);

    return { closed, element: fixture.nativeElement as HTMLElement };
  }

  it('renders nothing while closed', () => {
    const { element } = setup(false);

    expect(element.querySelector('aside')).toBeNull();
  });

  it('shows the heading when open', () => {
    const { element } = setup(true);

    expect(element.querySelector('h2')?.textContent?.trim()).toBe('Nouvelle unité');
  });

  it('asks to close when Escape is pressed', () => {
    const { closed } = setup(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape while closed', () => {
    const { closed } = setup(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(closed).not.toHaveBeenCalled();
  });

  it('asks to close when the backdrop is clicked', () => {
    const { closed, element } = setup(true);

    element.querySelector<HTMLElement>('.backdrop')!.click();

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('asks to close when the close button is clicked', () => {
    const { closed, element } = setup(true);

    element.querySelector<HTMLElement>('button[aria-label="Fermer"]')!.click();

    expect(closed).toHaveBeenCalledTimes(1);
  });
});
