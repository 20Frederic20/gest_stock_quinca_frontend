import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormControl, FormRecord, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error.model';
import { Transfer, TransferLine, TransferReceiveLineRequest } from '../../core/models/transfer.model';
import { FieldErrorComponent } from '../../shared/field-error/field-error.component';
import { formatNumber } from '../articles/article-format';
import { TransfersService } from './transfers.service';

/**
 * Confirms what actually arrived, line by line. Each quantity defaults to what was shipped and is
 * capped there: a lower number is not an error, it means breakage or loss on the way. One atomic call
 * settles the whole transfer — unlike a purchase reception, there is no draft-then-confirm here.
 */
@Component({
  selector: 'app-transfer-receive-form',
  imports: [ReactiveFormsModule, FieldErrorComponent],
  templateUrl: './transfer-receive-form.component.html',
  styleUrl: './transfer-receive-form.component.css',
})
export class TransferReceiveFormComponent implements OnInit {
  private service = inject(TransfersService);

  transferId = input.required<string>();
  transferNumber = input('');
  lines = input.required<TransferLine[]>();

  received = output<Transfer>();
  cancelled = output<void>();

  saving = signal(false);
  formError = signal<string | null>(null);

  /** One quantity per line, keyed by the id of the transfer line. */
  quantities = new FormRecord<FormControl<number>>({});

  protected formatNumber = formatNumber;

  ngOnInit(): void {
    for (const line of this.lines()) {
      this.quantities.addControl(
        line.id,
        new FormControl(line.quantity, {
          nonNullable: true,
          validators: [Validators.required, Validators.min(0), Validators.max(line.quantity)],
        }),
      );
    }
  }

  submit(): void {
    if (this.quantities.invalid) {
      this.quantities.markAllAsTouched();
      return;
    }

    const lines: TransferReceiveLineRequest[] = this.lines().map(line => ({
      transferLineId: line.id,
      quantity: this.quantities.controls[line.id].value,
    }));

    this.saving.set(true);
    this.formError.set(null);

    this.service.receive(this.transferId(), { lines }).subscribe({
      next: transfer => {
        this.saving.set(false);
        this.received.emit(transfer);
      },
      error: (error: ApiError) => {
        this.saving.set(false);
        this.formError.set(error.message);
      },
    });
  }
}
