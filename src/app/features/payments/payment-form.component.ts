import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { Payment, PaymentMethod } from '../../core/models/payment.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { formatMoney } from '../pricing/price-rules';
import { PAYMENT_METHOD_LABELS, REFERENCE_LABELS, referenceRequired } from './payment-format';
import { PaymentsService } from './payments.service';

const DEFAULT_METHOD: PaymentMethod = 'CASH';

/**
 * Takes one payment on an invoice. The amount offered is everything that is left to pay, which is
 * also its ceiling: the backend refuses more, and refusing it here saves the cashier a round trip.
 */
@Component({
  selector: 'app-payment-form',
  imports: [ReactiveFormsModule, SelectSearchComponent, FieldErrorComponent],
  templateUrl: './payment-form.component.html',
  styleUrl: './payment-form.component.css',
})
export class PaymentFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(PaymentsService);

  invoiceId = input.required<string>();
  invoiceNumber = input('');
  /** What the invoice still owes, before this payment. */
  remainingToPay = input.required<number>();

  taken = output<Payment>();
  cancelled = output<void>();

  method = signal<PaymentMethod>(DEFAULT_METHOD);
  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  // Same rules as PaymentRequest on the backend, plus the ceiling it computes from the invoice.
  form = this.fb.nonNullable.group({
    method: [DEFAULT_METHOD, [Validators.required]],
    amount: [0, [Validators.required, Validators.min(0.0001)]],
    externalReference: ['', [Validators.maxLength(100)]],
  });

  methodLabel = computed(() => PAYMENT_METHOD_LABELS[this.method()]);
  referenceLabel = computed(() => REFERENCE_LABELS[this.method()]);
  referenceNeeded = computed(() => referenceRequired(this.method()));

  methodOptions = computed<SelectOption[]>(() =>
    (Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map(method => ({
      id: method,
      label: PAYMENT_METHOD_LABELS[method],
    })),
  );

  protected formatMoney = formatMoney;

  /** The input is only readable once the component is bound, hence here and not in the constructor. */
  ngOnInit(): void {
    // Collecting everything that is left is the common case: one payment settles the invoice.
    this.form.controls.amount.setValue(this.remainingToPay());
    this.form.controls.amount.addValidators(Validators.max(this.remainingToPay()));
    this.form.controls.amount.updateValueAndValidity();
  }

  onMethodSelected(option: SelectOption | null): void {
    if (!option) return;

    const method = option.id as PaymentMethod;
    this.method.set(method);
    this.form.controls.method.setValue(method);

    const reference = this.form.controls.externalReference;
    reference.setValidators(
      referenceRequired(method)
        ? [Validators.required, Validators.maxLength(100)]
        : [Validators.maxLength(100)],
    );
    reference.updateValueAndValidity();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set(null);
    this.fieldErrors.set({});

    const { method, amount, externalReference } = this.form.getRawValue();
    const reference = externalReference.trim();

    this.service
      .create(this.invoiceId(), { method, amount, externalReference: reference || null })
      .subscribe({
        next: payment => {
          this.saving.set(false);
          this.taken.emit(payment);
        },
        error: (error: ApiError) => {
          this.saving.set(false);
          this.formError.set(error.message);
          this.fieldErrors.set(error.fieldErrors);
        },
      });
  }
}
