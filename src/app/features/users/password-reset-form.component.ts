import { Component, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { UsersService } from './users.service';

/** Both fields must hold the same password: a typo would otherwise lock the user out. */
function sameValues(group: AbstractControl): ValidationErrors | null {
  const newPassword = group.get('newPassword')?.value;
  const confirmation = group.get('confirmation')?.value;
  return newPassword === confirmation ? null : { mismatch: true };
}

/** Reset by an administrator: the current password is not needed. */
@Component({
  selector: 'app-password-reset-form',
  imports: [ReactiveFormsModule, FieldErrorComponent],
  templateUrl: './password-reset-form.component.html',
  styleUrl: './password-reset-form.component.css',
})
export class PasswordResetFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(UsersService);

  userId = input.required<string>();
  userName = input('');
  saved = output<void>();
  cancelled = output<void>();

  saving = signal(false);
  formError = signal<string | null>(null);

  // Same limits as ResetPasswordRequest on the backend.
  form = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(100)]],
      confirmation: ['', [Validators.required]],
    },
    { validators: sameValues },
  );

  /** Bumped on every form event: `touched` and the group errors are not signals, and the component is OnPush. */
  private formChanges = signal(0);

  showMismatch = computed(() => {
    this.formChanges();
    return this.form.hasError('mismatch') && this.form.controls.confirmation.touched;
  });

  constructor() {
    this.form.events.pipe(takeUntilDestroyed()).subscribe(() => this.formChanges.update(n => n + 1));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    this.service.resetPassword(this.userId(), this.form.getRawValue().newPassword).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit();
      },
      error: (error: ApiError) => {
        this.saving.set(false);
        this.formError.set(error.message);
      },
    });
  }
}
