import { FormControl, Validators } from '@angular/forms';
import { fieldErrorMessage } from './field-error.component';

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

  it('gives priority to the server message, even on an untouched field', () => {
    const control = new FormControl('ABC');

    expect(fieldErrorMessage(control, 'Ce code existe déjà')).toBe('Ce code existe déjà');
  });
});
