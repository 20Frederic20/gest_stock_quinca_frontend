import { Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

/** Turns the first error of a form control into a readable message. */
export function fieldErrorMessage(
  control: AbstractControl | null,
  serverError: string | undefined,
): string | null {
  // The backend has the final say: its message is shown even on an untouched field.
  if (serverError) return serverError;
  if (!control || !control.touched || !control.errors) return null;

  const errors = control.errors;
  if (errors['required']) return 'Ce champ est obligatoire';
  if (errors['maxlength']) return `Ce champ ne doit pas dépasser ${errors['maxlength'].requiredLength} caractères`;
  if (errors['min']) return `La valeur minimale est ${errors['min'].min}`;
  if (errors['max']) return `La valeur maximale est ${errors['max'].max}`;
  return 'Valeur invalide';
}

@Component({
  selector: 'app-field-error',
  templateUrl: './field-error.component.html',
  styleUrl: './field-error.component.css',
})
export class FieldErrorComponent {
  control = input<AbstractControl | null>(null);
  serverError = input<string | undefined>(undefined);

  /** A getter rather than computed(): `touched` and `errors` are not signals. */
  get message(): string | null {
    return fieldErrorMessage(this.control(), this.serverError());
  }
}
