import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { Agency, AgencyRequest } from '../../core/models/agency.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { AgenciesService } from './agencies.service';

/** Blank → null, so that the backend stores "no value" rather than an empty text. */
const orNull = (value: string) => value.trim() || null;

/** Create form when `agency` is null, edit form otherwise. Saves by itself. */
@Component({
  selector: 'app-agency-form',
  imports: [ReactiveFormsModule, FieldErrorComponent],
  templateUrl: './agency-form.component.html',
  styleUrl: './agency-form.component.css',
})
export class AgencyFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(AgenciesService);

  agency = input<Agency | null>(null);
  saved = output<void>();
  cancelled = output<void>();

  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  // Same limits as AgencyRequest on the backend.
  form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(20)]],
    label: ['', [Validators.required, Validators.maxLength(150)]],
    address: ['', [Validators.maxLength(255)]],
    phone: ['', [Validators.maxLength(30)]],
    taxId: ['', [Validators.maxLength(30)]],
  });

  constructor() {
    // Refills the form whenever another agency is selected while the panel stays open.
    effect(() => {
      const agency = this.agency();
      this.formError.set(null);
      this.fieldErrors.set({});
      this.form.reset({
        code: agency?.code ?? '',
        label: agency?.label ?? '',
        address: agency?.address ?? '',
        phone: agency?.phone ?? '',
        taxId: agency?.taxId ?? '',
      });
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

    const value = this.form.getRawValue();
    const body: AgencyRequest = {
      code: value.code.trim(),
      label: value.label.trim(),
      address: orNull(value.address),
      phone: orNull(value.phone),
      taxId: orNull(value.taxId),
    };
    const agency = this.agency();
    const request = agency ? this.service.update(agency.id, body) : this.service.create(body);

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
