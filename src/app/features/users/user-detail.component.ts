import { Component, input, output } from '@angular/core';
import { ROLE_LABELS, User } from '../../core/models/user.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { formatDate, formatNumber } from '../articles/article-format';

/** Read-only sheet of a user, with its actions. The list decides what each action does. */
@Component({
  selector: 'app-user-detail',
  imports: [BadgeComponent],
  templateUrl: './user-detail.component.html',
  styleUrl: './user-detail.component.css',
})
export class UserDetailComponent {
  user = input.required<User>();
  /** true = the logged-in administrator: deactivating or deleting oneself would lock one out. */
  isSelf = input(false);

  edit = output<void>();
  resetPassword = output<void>();
  toggleActive = output<void>();
  delete = output<void>();

  protected roleLabels = ROLE_LABELS;
  protected formatDate = formatDate;
  protected formatNumber = formatNumber;
}
