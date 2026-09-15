import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { FieldErrorComponent, fieldErrorMessage } from './field-error.component';

@Component({
  imports: [FieldErrorComponent],
  template: `<app-field-error [control]="control" />`,
})
class HostComponent {
  control = new FormControl('', Validators.required);
}

describe('FieldErrorComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const text = () => (fixture.nativeElement as HTMLElement).textContent?.trim();
    return { fixture, control: fixture.componentInstance.control, text };
  }

  it('shows the message once the form is submitted, although its input has not changed', async () => {
    const { fixture, control, text } = setup();
    expect(text()).toBe('');

    // What submit() does: `touched` is not a signal, and the control reference stays the same.
    control.markAsTouched();
    await fixture.whenStable();

    expect(text()).toBe('Ce champ est obligatoire');
  });

  it('hides the message as soon as the field becomes valid', async () => {
    const { fixture, control, text } = setup();
    control.markAsTouched();
    await fixture.whenStable();

    control.setValue('SAC');
    await fixture.whenStable();

    expect(text()).toBe('');
  });
});

describe('fieldErrorMessage', () => {
  it('stays silent while the field has not been touched', () => {
    const control = new FormControl('', Validators.required);

    expect(fieldErrorMessage(control, undefined)).toBeNull();
  });

  it('stays silent for a valid touched field', () => {
    const control = new FormControl('SAC', Validators.required);
    control.markAsTouched();

    expect(fieldErrorMessage(control, undefined)).toBeNull();
  });

  it('reports a required field left empty', () => {
    const control = new FormControl('', Validators.required);
    control.markAsTouched();

    expect(fieldErrorMessage(control, undefined)).toBe('Ce champ est obligatoire');
  });

  it('reports a value that is too long', () => {
    const control = new FormControl('abcd', Validators.maxLength(3));
    control.markAsTouched();

    expect(fieldErrorMessage(control, undefined)).toBe('Ce champ ne doit pas dépasser 3 caractères');
  });

  it('reports a value below the minimum', () => {
    const control = new FormControl(-1, Validators.min(0));
    control.markAsTouched();

    expect(fieldErrorMessage(control, undefined)).toBe('La valeur minimale est 0');
  });

  it('reports a value above the maximum', () => {
    const control = new FormControl(101, Validators.max(100));
    control.markAsTouched();

    expect(fieldErrorMessage(control, undefined)).toBe('La valeur maximale est 100');
  });

  it('reports a value that is too short', () => {
    const control = new FormControl('ab', Validators.minLength(3));
    control.markAsTouched();

    expect(fieldErrorMessage(control, undefined)).toBe('Ce champ doit contenir au moins 3 caractères');
  });

  it('reports a value in the wrong format', () => {
    const control = new FormControl('awa dossou', Validators.pattern(/^[a-z.]+$/));
    control.markAsTouched();

    expect(fieldErrorMessage(control, undefined)).toBe('Format invalide');
  });

  it('reports a date before the allowed one, in French format', () => {
    const control = new FormControl('2026-09-13');
    control.setErrors({ minDate: { min: '2026-09-15' } });
    control.markAsTouched();

    expect(fieldErrorMessage(control, undefined)).toBe('La date doit être le 15/09/2026 ou après');
  });

  it('gives priority to the server message, even on an untouched field', () => {
    const control = new FormControl('ABC');

    expect(fieldErrorMessage(control, 'Ce code existe déjà')).toBe('Ce code existe déjà');
  });
});
