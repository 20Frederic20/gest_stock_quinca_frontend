import { TestBed } from '@angular/core/testing';
import { ConfirmDialogComponent } from './confirm-dialog.component';

describe('ConfirmDialogComponent', () => {
  function setup(open: boolean) {
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.componentRef.setInput('open', open);
    fixture.componentRef.setInput('message', "L'unité « Sac » sera définitivement supprimée.");
    fixture.detectChanges();

    const confirmed = vi.fn();
    const cancelled = vi.fn();
    fixture.componentInstance.confirmed.subscribe(confirmed);
    fixture.componentInstance.cancelled.subscribe(cancelled);

    return { confirmed, cancelled, element: fixture.nativeElement as HTMLElement };
  }

  it('renders nothing while closed', () => {
    const { element } = setup(false);

    expect(element.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('shows the message when open', () => {
    const { element } = setup(true);

    expect(element.textContent).toContain("L'unité « Sac » sera définitivement supprimée.");
  });

  it('emits confirmed when the confirm button is clicked', () => {
    const { confirmed, cancelled, element } = setup(true);

    element.querySelector<HTMLElement>('button.btn-danger')!.click();

    expect(confirmed).toHaveBeenCalledTimes(1);
    expect(cancelled).not.toHaveBeenCalled();
  });

  it('emits cancelled when the cancel button is clicked', () => {
    const { confirmed, cancelled, element } = setup(true);

    element.querySelector<HTMLElement>('button:not(.btn-danger)')!.click();

    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(confirmed).not.toHaveBeenCalled();
  });

  it('emits cancelled when Escape is pressed', () => {
    const { cancelled } = setup(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(cancelled).toHaveBeenCalledTimes(1);
  });
});
