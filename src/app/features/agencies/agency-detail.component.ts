import { Component, input, output } from '@angular/core';
import { Agency } from '../../core/models/agency.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { formatDate } from '../articles/article-format';

/** Read-only sheet of an agency, with its actions. The list decides what each action does. */
@Component({
  selector: 'app-agency-detail',
  imports: [BadgeComponent],
  templateUrl: './agency-detail.component.html',
  styleUrl: './agency-detail.component.css',
})
export class AgencyDetailComponent {
  agency = input.required<Agency>();

  edit = output<void>();
  toggleActive = output<void>();
  delete = output<void>();

  protected formatDate = formatDate;
}
