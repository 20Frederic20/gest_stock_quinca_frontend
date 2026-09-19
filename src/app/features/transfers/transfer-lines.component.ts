import { Component, inject, input, output, signal } from '@angular/core';
import { ApiError } from '../../core/http/api-error.model';
import { Transfer, TransferLine } from '../../core/models/transfer.model';
import { formatNumber } from '../articles/article-format';
import { TransfersService } from './transfers.service';

/**
 * Lines of a transfer. On a draft, a line can be removed — there is nothing to correct in place,
 * since the backend has no line-update endpoint: a wrong quantity is removed and added again. Once
 * received, the actually-received quantity is shown alongside what was shipped.
 */
@Component({
  selector: 'app-transfer-lines',
  templateUrl: './transfer-lines.component.html',
  styleUrl: './transfer-lines.component.css',
})
export class TransferLinesComponent {
  private service = inject(TransfersService);

  transferId = input.required<string>();
  lines = input.required<TransferLine[]>();
  editable = input(false);
  /** True once the transfer is received: the received quantity has something to show. */
  showReceived = input(false);

  changed = output<Transfer>();
  failed = output<string>();

  busy = signal(false);

  protected formatNumber = formatNumber;

  remove(line: TransferLine): void {
    this.busy.set(true);

    this.service.removeLine(this.transferId(), line.id).subscribe({
      next: transfer => {
        this.busy.set(false);
        this.changed.emit(transfer);
      },
      error: (error: ApiError) => {
        this.busy.set(false);
        this.failed.emit(error.message);
      },
    });
  }
}
