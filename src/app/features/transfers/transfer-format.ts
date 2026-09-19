import { Transfer, TransferStatus } from '../../core/models/transfer.model';
import { BadgeTone } from '../../shared/badge/badge.component';

export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyé',
  RECEIVED: 'Réceptionné',
  CANCELLED: 'Annulé',
};

/** What still waits for something stands out; what is done or dropped fades. */
export const TRANSFER_STATUS_TONES: Record<TransferStatus, BadgeTone> = {
  DRAFT: 'accent',
  SENT: 'accent',
  RECEIVED: 'neutral',
  CANCELLED: 'muted',
};

/** Backend rule: only a sent transfer is still waiting for its reception. */
export function isReceivable(transfer: Transfer): boolean {
  return transfer.status === 'SENT';
}

/** Backend rule: a draft is deleted, not cancelled; a sent or received transfer can still be cancelled. */
export function transferCancellable(transfer: Transfer): boolean {
  return transfer.status === 'SENT' || transfer.status === 'RECEIVED';
}
