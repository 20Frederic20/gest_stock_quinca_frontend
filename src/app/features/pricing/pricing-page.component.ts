import { Component } from '@angular/core';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PriceListComponent } from './price-list.component';
import { PrivilegeListComponent } from './privilege-list.component';

/** "Tarifs et privilèges": the price lists, then the prices of a packaging. */
@Component({
  selector: 'app-pricing-page',
  imports: [PageHeaderComponent, PrivilegeListComponent, PriceListComponent],
  templateUrl: './pricing-page.component.html',
  styleUrl: './pricing-page.component.css',
})
export class PricingPageComponent {}
