import { Component, OnInit, computed, inject } from '@angular/core';
import { CurrentAgencyService } from '../../core/agency/current-agency.service';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';

@Component({
  selector: 'app-header',
  imports: [SelectSearchComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent implements OnInit {
  private currentAgency = inject(CurrentAgencyService);

  current = this.currentAgency.current;
  loaded = this.currentAgency.loaded;
  agencyOptions = computed<SelectOption[]>(() =>
    this.currentAgency.agencies().map(agency => ({ id: agency.id, label: agency.label })),
  );

  /** The backend has no user yet: this value is fixed. */
  userName = 'Administrateur';

  today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  ngOnInit(): void {
    this.currentAgency.refresh();
  }

  onAgencySelected(option: SelectOption | null): void {
    if (option) this.currentAgency.select(option.id);
  }
}
