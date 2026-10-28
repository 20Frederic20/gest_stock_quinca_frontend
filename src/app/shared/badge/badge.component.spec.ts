import { TestBed } from '@angular/core/testing';
import { BadgeComponent, BadgeTone } from './badge.component';

describe('BadgeComponent', () => {
  function render(tone?: BadgeTone) {
    const fixture = TestBed.createComponent(BadgeComponent);
    fixture.componentRef.setInput('text', 'Actif');
    if (tone) fixture.componentRef.setInput('tone', tone);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('span')!;
  }

  it('shows its text with the neutral style by default', () => {
    const span = render();

    expect(span.textContent?.trim()).toBe('Actif');
    expect(span.className.trim()).toBe('tag');
  });

  it('applies the accent and muted tones', () => {
    expect(render('accent').classList).toContain('tag-accent');
    expect(render('muted').classList).toContain('tag-muted');
  });
});
