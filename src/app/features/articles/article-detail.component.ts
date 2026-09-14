import { Component, input, output } from '@angular/core';
import { Article } from '../../core/models/article.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { formatDate, formatNumber, rateToPercent } from './article-format';

/** Read-only sheet of an article, with its actions. The list decides what each action does. */
@Component({
  selector: 'app-article-detail',
  imports: [BadgeComponent],
  templateUrl: './article-detail.component.html',
  styleUrl: './article-detail.component.css',
})
export class ArticleDetailComponent {
  article = input.required<Article>();
  /** false = read-only user: the sheet shows no action. */
  canEdit = input(true);

  edit = output<void>();
  toggleActive = output<void>();
  delete = output<void>();

  protected formatDate = formatDate;
  protected formatNumber = formatNumber;
  protected rateToPercent = rateToPercent;
}
