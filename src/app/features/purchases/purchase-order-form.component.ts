import { Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { PurchaseOrder } from '../../core/models/purchase-order.model';
import { Supplier } from '../../core/models/supplier.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { SuppliersService } from '../suppliers/suppliers.service';
import { PurchaseOrdersService } from './purchase-orders.service';

/** The backend refuses a delivery date in the past: refusing it here saves a round trip. */
function notPast(control: AbstractControl): ValidationErrors | null {
  const value = control.value as string;
  return value && value < new Date().toISOString().slice(0, 10) ? { past: true } : null;
}

/**
 * Opens a purchase order: who supplies, when it is expected, why. The articles are added afterwards,
 * on the order itself — the backend accepts a draft without a single line.
 */
@Component({
  selector: 'app-purchase-order-form',
  imports: [ReactiveFormsModule, SelectSearchComponent, FieldErrorComponent],
  templateUrl: './purchase-order-form.component.html',
  styleUrl: './purchase-order-form.component.css',
})
export class PurchaseOrderFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(PurchaseOrdersService);
  private suppliersService = inject(SuppliersService);

  saved = output<PurchaseOrder>();
  cancelled = output<void>();

  suppliers = signal<Supplier[]>([]);
  supplierLabel = signal('');
  saving = signal(false);
  formError = signal<string | null>(null);

  // Same rules as PurchaseOrderCreateRequest on the backend.
  form = this.fb.nonNullable.group({
    supplierId: ['', [Validators.required]],
    expectedDeliveryDate: ['', [notPast]],
    comment: ['', [Validators.maxLength(500)]],
  });

  /** Only the suppliers still in use: the backend refuses a deactivated one. */
  supplierOptions = computed<SelectOption[]>(() =>
    this.suppliers().map(supplier => ({ id: supplier.id, label: `${supplier.code} — ${supplier.companyName}` })),
  );

  ngOnInit(): void {
    this.suppliersService.getActive().subscribe({
      next: suppliers => this.suppliers.set(suppliers),
      error: (error: ApiError) => this.formError.set(`Fournisseurs indisponibles : ${error.message}`),
    });
  }

  onSupplierSelected(option: SelectOption | null): void {
    this.form.controls.supplierId.setValue(option?.id ?? '');
    this.form.controls.supplierId.markAsTouched();
    this.supplierLabel.set(option?.label ?? '');
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    const { supplierId, expectedDeliveryDate, comment } = this.form.getRawValue();

    this.service
      .create({
        supplierId,
        expectedDeliveryDate: expectedDeliveryDate || null,
        comment: comment.trim() || null,
        lines: [],
      })
      .subscribe({
        next: order => {
          this.saving.set(false);
          this.saved.emit(order);
        },
        error: (error: ApiError) => {
          this.saving.set(false);
          this.formError.set(error.message);
        },
      });
  }
}
