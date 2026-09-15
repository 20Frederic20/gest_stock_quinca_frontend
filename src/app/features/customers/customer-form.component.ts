import { Component, computed, effect, inject, input, linkedSignal, output, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { CUSTOMER_TYPE_LABELS, Customer, CustomerRequest, CustomerType } from '../../core/models/customer.model';
import { Privilege } from '../../core/models/privilege.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { CustomersService } from './customers.service';

const DEFAULT_TYPE: CustomerType = 'INDIVIDUAL';

/** Blank → null, so that the backend stores "no value" rather than an empty text. */
const orNull = (value: string) => value.trim() || null;

/**
 * Create form when `customer` is null, edit form otherwise. Saves by itself.
 * A new customer starts on cash payment and the default price grid.
 */
@Component({
  selector: 'app-customer-form',
  imports: [ReactiveFormsModule, FieldErrorComponent, SelectSearchComponent],
  templateUrl: './customer-form.component.html',
  styleUrl: './customer-form.component.css',
})
export class CustomerFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(CustomersService);

  customer = input<Customer | null>(null);
  privileges = input<Privilege[]>([]);
  saved = output<void>();
  cancelled = output<void>();

  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  private defaultPrivilege = computed(() => this.privileges().find(p => p.isDefault) ?? null);

  // Texts shown in the selects; the form only holds the values. Reset with the customer, overwritten by a choice.
  typeLabel = linkedSignal(() => CUSTOMER_TYPE_LABELS[this.customer()?.type ?? DEFAULT_TYPE]);
  privilegeLabel = linkedSignal(() => this.customer()?.privilegeLabel ?? this.defaultPrivilege()?.label ?? '');

  // Same rules as CustomerRequest on the backend.
  form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(30)]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    type: [DEFAULT_TYPE, [Validators.required]],
    phone: ['', [Validators.maxLength(30)]],
    address: ['', [Validators.maxLength(255)]],
    taxId: ['', [Validators.maxLength(30)]],
    creditLimit: [0, [Validators.required, Validators.min(0)]],
    paymentTermDays: [0, [Validators.required, Validators.min(0), Validators.max(365), Validators.pattern(/^\d+$/)]],
    comment: ['', [Validators.maxLength(500)]],
    privilegeId: ['', [Validators.required]],
  });

  typeOptions = computed<SelectOption[]>(() =>
    (Object.keys(CUSTOMER_TYPE_LABELS) as CustomerType[]).map(type => ({ id: type, label: CUSTOMER_TYPE_LABELS[type] })),
  );

  privilegeOptions = computed<SelectOption[]>(() =>
    this.privileges().map(privilege => ({ id: privilege.id, label: privilege.label })),
  );

  constructor() {
    // Refills the form whenever another customer is selected while the panel stays open.
    effect(() => {
      const customer = this.customer();
      this.formError.set(null);
      this.fieldErrors.set({});
      this.form.reset({
        code: customer?.code ?? '',
        name: customer?.name ?? '',
        type: customer?.type ?? DEFAULT_TYPE,
        phone: customer?.phone ?? '',
        address: customer?.address ?? '',
        taxId: customer?.taxId ?? '',
        creditLimit: customer?.creditLimit ?? 0,
        paymentTermDays: customer?.paymentTermDays ?? 0,
        comment: customer?.comment ?? '',
        privilegeId: customer?.privilegeId ?? untracked(this.defaultPrivilege)?.id ?? '',
      });
    });

    // The privileges may arrive after the panel opened: a new customer then gets the default grid,
    // without wiping what was already typed.
    effect(() => {
      const fallback = this.defaultPrivilege();
      const control = this.form.controls.privilegeId;
      if (fallback && !this.customer() && !control.value) control.setValue(fallback.id);
    });
  }

  onTypeSelected(option: SelectOption | null): void {
    if (!option) return;
    this.form.controls.type.setValue(option.id as CustomerType);
    this.typeLabel.set(option.label);
  }

  onPrivilegeSelected(option: SelectOption | null): void {
    if (!option) return;
    this.form.controls.privilegeId.setValue(option.id);
    this.privilegeLabel.set(option.label);
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
    const body: CustomerRequest = {
      code: value.code.trim(),
      name: value.name.trim(),
      type: value.type,
      phone: orNull(value.phone),
      address: orNull(value.address),
      taxId: orNull(value.taxId),
      creditLimit: value.creditLimit,
      paymentTermDays: value.paymentTermDays,
      comment: orNull(value.comment),
      privilegeId: value.privilegeId,
    };
    const customer = this.customer();
    const request = customer ? this.service.update(customer.id, body) : this.service.create(body);

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
