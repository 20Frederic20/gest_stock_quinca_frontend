import { Component, signal } from '@angular/core';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PriceListComponent } from './price-list.component';
import { PrivilegeListComponent } from './privilege-list.component';

type Tab = 'grids' | 'prices';

/**
 * Référentiel > Tarifs et prix. Two referentials that answer two different questions — which grids
 * exist, and what an article costs in one of them — so they are two tabs rather than one long page.
 * Only the open tab is built, so only it asks the backend for anything.
 */
@Component({
  selector: 'app-pricing-page',
  imports: [PageHeaderComponent, PrivilegeListComponent, PriceListComponent],
  templateUrl: './pricing-page.component.html',
  styleUrl: './pricing-page.component.css',
})
export class PricingPageComponent {
  tab = signal<Tab>('grids');

  show(tab: Tab): void {
    this.tab.set(tab);
  }
}
