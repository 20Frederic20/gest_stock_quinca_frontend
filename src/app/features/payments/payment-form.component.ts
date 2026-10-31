import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { Payment, PaymentMethod, PaymentRequest } from '../../core/models/payment.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { formatMoney } from '../pricing/price-rules';
import { CashDayStatus } from '../../core/models/day-closing.model';
import { DayClosingService } from '../day-closing/day-closing.service';
import { PAYMENT_METHOD_LABELS, formatDateTime, REFERENCE_LABELS, referenceRequired } from './payment-format';
import { PaymentsService } from './payments.service';

const DEFAULT_METHOD: PaymentMethod = 'CASH';

// Exact refusals of the backend when the cash day changed between the status check and the payment.
const NO_OPEN_DAY_ERROR =
  "Aucune journée de caisse n'est ouverte pour cette agence : confirmez son ouverture automatique.";
const STALE_DAY_ERROR =
  "La journée de caisse est ouverte depuis plus de 24 heures : confirmez l'encaissement sur cette journée.";

/** What the cashier must confirm before the payment goes out. */
type DayPrompt = { kind: 'open'; suggestedOpeningCash: number } | { kind: 'stale'; openedAt: string };

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
  private dayClosings = inject(DayClosingService);
  /** The race re-check happens once per submit, so a persistent refusal cannot loop. */
  private raceRetried = false;

  invoiceId = input.required<string>();
  /** The agency of the invoice: its cash day is the one the payment lands in. */
  agencyId = input.required<string>();
  invoiceNumber = input('');
  /** What the invoice still owes, before this payment. */
  remainingToPay = input.required<number>();

  taken = output<Payment>();
  cancelled = output<void>();

  method = signal<PaymentMethod>(DEFAULT_METHOD);
  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});
  /** Set while a confirmation about the cash day waits for the cashier. */
  dayPrompt = signal<DayPrompt | null>(null);
  openingCash = new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] });

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
  protected formatDateTime = formatDateTime;

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
    this.raceRetried = false;
    this.checkCashDay();
  }

  /** Every payment belongs to an open cash day: ask the backend where we stand before sending it. */
  private checkCashDay(): void {
    this.dayClosings.getCashStatus(this.agencyId()).subscribe({
      next: status => this.onCashStatus(status),
      error: (error: ApiError) => this.fail(error),
    });
  }

  private onCashStatus(status: CashDayStatus): void {
    if (!status.open) {
      this.openingCash.setValue(status.suggestedOpeningCash);
      this.dayPrompt.set({ kind: 'open', suggestedOpeningCash: status.suggestedOpeningCash });
    } else if (status.stale && status.openedAt) {
      this.dayPrompt.set({ kind: 'stale', openedAt: status.openedAt });
    } else {
      this.send({});
    }
  }

  confirmDayPrompt(): void {
    const prompt = this.dayPrompt();
    if (!prompt) return;

    if (prompt.kind === 'open') {
      if (this.openingCash.invalid) {
        this.openingCash.markAsTouched();
        return;
      }
      this.dayPrompt.set(null);
      this.send({ openDayIfClosed: true, openingCashAmount: this.openingCash.value });
    } else {
      this.dayPrompt.set(null);
      this.send({ confirmStaleDay: true });
    }
  }

  /** Nothing was sent: the form stays as typed. */
  cancelDayPrompt(): void {
    this.dayPrompt.set(null);
    this.saving.set(false);
  }

  private send(dayFields: Pick<PaymentRequest, 'openDayIfClosed' | 'openingCashAmount' | 'confirmStaleDay'>): void {
    const { method, amount, externalReference } = this.form.getRawValue();
    const reference = externalReference.trim();

    this.service
      .create(this.invoiceId(), { method, amount, externalReference: reference || null, ...dayFields })
      .subscribe({
        next: payment => {
          this.saving.set(false);
          this.taken.emit(payment);
        },
        error: (error: ApiError) => {
          // The day was closed or aged between the check and the payment: look again, once.
          if (!this.raceRetried && (error.message === NO_OPEN_DAY_ERROR || error.message === STALE_DAY_ERROR)) {
            this.raceRetried = true;
            this.checkCashDay();
            return;
          }
          this.fail(error);
        },
      });
  }

  private fail(error: ApiError): void {
    this.saving.set(false);
    this.formError.set(error.message);
    this.fieldErrors.set(error.fieldErrors);
  }
}
