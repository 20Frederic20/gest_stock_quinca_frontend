import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { Privilege } from '../../core/models/privilege.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { PrivilegesService } from './privileges.service';

/** Create form when `privilege` is null, edit form otherwise. Saves by itself. */
@Component({
  selector: 'app-privilege-form',
  imports: [ReactiveFormsModule, FieldErrorComponent],
  templateUrl: './privilege-form.component.html',
  styleUrl: './privilege-form.component.css',
})
export class PrivilegeFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(PrivilegesService);

  privilege = input<Privilege | null>(null);
  saved = output<void>();
  cancelled = output<void>();

  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  // Same limits as PrivilegeRequest on the backend.
  form = this.fb.nonNullable.group({
    label: ['', [Validators.required, Validators.maxLength(100)]],
    isDefault: [false],
  });

  constructor() {
    // Refills the form whenever another privilege is selected while the panel stays open.
    effect(() => {
      const privilege = this.privilege();
      this.formError.set(null);
      this.fieldErrors.set({});
      this.form.reset({ label: privilege?.label ?? '', isDefault: privilege?.isDefault ?? false });

      // The backend refuses to unset the default without naming another one first.
      if (privilege?.isDefault) this.form.controls.isDefault.disable();
      else this.form.controls.isDefault.enable();
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set(null);
    this.fieldErrors.set({});

    // getRawValue() keeps the locked checkbox, which value() would leave out.
    const body = this.form.getRawValue();
    const privilege = this.privilege();
    const request = privilege ? this.service.update(privilege.id, body) : this.service.create(body);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit();
      },
      error: (error: ApiError) => {
        this.saving.set(false);
        this.formError.set(error.message);
        this.fieldErrors.set(error.fieldErrors);
      },
    });
  }
}
