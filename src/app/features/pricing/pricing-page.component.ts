import { Component } from '@angular/core';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PrivilegeListComponent } from './privilege-list.component';

/** "Tarifs et privilèges": the price lists, then the prices of a packaging (next step). */
@Component({
  selector: 'app-pricing-page',
  imports: [PageHeaderComponent, PrivilegeListComponent],
  templateUrl: './pricing-page.component.html',
  styleUrl: './pricing-page.component.css',
})
export class PricingPageComponent {}
