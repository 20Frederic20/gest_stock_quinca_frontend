import { Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { Agency } from '../../core/models/agency.model';
import { Transfer } from '../../core/models/transfer.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { AgenciesService } from '../agencies/agencies.service';
import { TransfersService } from './transfers.service';

/**
 * Opens a transfer: where the goods go, when, and why. The articles are added afterwards, on the
 * transfer itself — the backend accepts a draft without a single line. The source is always the
 * user's own agency: nothing leaves an agency someone else manages.
 */
@Component({
  selector: 'app-transfer-form',
  imports: [ReactiveFormsModule, SelectSearchComponent, FieldErrorComponent],
  templateUrl: './transfer-form.component.html',
  styleUrl: './transfer-form.component.css',
})
export class TransferFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(TransfersService);
  private agenciesService = inject(AgenciesService);
  private auth = inject(AuthService);

  saved = output<Transfer>();
  cancelled = output<void>();

  agencies = signal<Agency[]>([]);
  destinationLabel = signal('');
  saving = signal(false);
  formError = signal<string | null>(null);

  sourceAgencyId = computed(() => this.auth.user()?.agencyId ?? '');
  sourceAgencyLabel = computed(() => this.auth.user()?.agencyLabel ?? '');

  // Same rules as TransferCreateRequest on the backend.
  form = this.fb.nonNullable.group({
    destinationAgencyId: ['', [Validators.required]],
    transferDate: [''],
    comment: ['', [Validators.maxLength(500)]],
  });

  /** Every agency but the user's own: a transfer needs two different ends. */
  destinationOptions = computed<SelectOption[]>(() =>
    this.agencies()
      .filter(agency => agency.id !== this.sourceAgencyId())
      .map(agency => ({ id: agency.id, label: agency.label })),
  );

  ngOnInit(): void {
    this.agenciesService.getActive().subscribe({
      next: agencies => this.agencies.set(agencies),
      error: (error: ApiError) => this.formError.set(`Agences indisponibles : ${error.message}`),
    });
  }

  onDestinationSelected(option: SelectOption | null): void {
    this.form.controls.destinationAgencyId.setValue(option?.id ?? '');
    this.form.controls.destinationAgencyId.markAsTouched();
    this.destinationLabel.set(option?.label ?? '');
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    const { destinationAgencyId, transferDate, comment } = this.form.getRawValue();

    this.service
      .create({
        sourceAgencyId: this.sourceAgencyId(),
        destinationAgencyId,
        transferDate: transferDate || null,
        comment: comment.trim() || null,
        lines: [],
      })
      .subscribe({
        next: transfer => {
          this.saving.set(false);
          this.saved.emit(transfer);
        },
        error: (error: ApiError) => {
          this.saving.set(false);
          this.formError.set(error.message);
        },
      });
  }
}
