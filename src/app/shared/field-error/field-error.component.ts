import { Component, computed, effect, input, signal } from '@angular/core';
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
  if (errors['minDate']) {
    const [year, month, day] = (errors['minDate'].min as string).split('-');
    return `La date doit être le ${day}/${month}/${year} ou après`;
  }
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

  /**
   * Bumped on every event of the control. `touched` and `errors` are not signals, and the
   * component is OnPush: without this, markAllAsTouched() on submit would show nothing.
   */
  private controlChanges = signal(0);

  message = computed(() => {
    this.controlChanges();
    return fieldErrorMessage(this.control(), this.serverError());
  });

  constructor() {
    effect(onCleanup => {
      const subscription = this.control()?.events.subscribe(() => this.controlChanges.update(n => n + 1));
      onCleanup(() => subscription?.unsubscribe());
    });
  }
}
