import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { Supplier, SupplierRequest } from '../../core/models/supplier.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { SuppliersService } from './suppliers.service';

/** Blank → null, so that the backend stores "no value" rather than an empty text. */
const orNull = (value: string) => value.trim() || null;

/** Create form when `supplier` is null, edit form otherwise. Saves by itself. */
@Component({
  selector: 'app-supplier-form',
  imports: [ReactiveFormsModule, FieldErrorComponent],
  templateUrl: './supplier-form.component.html',
  styleUrl: './supplier-form.component.css',
})
export class SupplierFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(SuppliersService);

  supplier = input<Supplier | null>(null);
  saved = output<void>();
  cancelled = output<void>();

  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  // Same rules as SupplierRequest on the backend.
  form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(30)]],
    companyName: ['', [Validators.required, Validators.maxLength(200)]],
    phone: ['', [Validators.maxLength(30)]],
    address: ['', [Validators.maxLength(255)]],
    taxId: ['', [Validators.maxLength(30)]],
    paymentTerms: ['', [Validators.maxLength(255)]],
  });

  constructor() {
    // Refills the form whenever another supplier is selected while the panel stays open.
    effect(() => {
      const supplier = this.supplier();
      this.formError.set(null);
      this.fieldErrors.set({});
      this.form.reset({
        code: supplier?.code ?? '',
        companyName: supplier?.companyName ?? '',
        phone: supplier?.phone ?? '',
        address: supplier?.address ?? '',
        taxId: supplier?.taxId ?? '',
        paymentTerms: supplier?.paymentTerms ?? '',
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
    const body: SupplierRequest = {
      code: value.code.trim(),
      companyName: value.companyName.trim(),
      phone: orNull(value.phone),
      address: orNull(value.address),
      taxId: orNull(value.taxId),
      paymentTerms: orNull(value.paymentTerms),
    };

    const supplier = this.supplier();
    const request = supplier ? this.service.update(supplier.id, body) : this.service.create(body);

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
