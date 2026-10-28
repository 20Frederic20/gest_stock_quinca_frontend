import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { MENU, visibleMenu } from '../menu';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  private auth = inject(AuthService);

  /** Recomputed when the user changes, e.g. after logging in as someone else. */
  menu = computed(() => visibleMenu(MENU, permission => this.auth.can(permission)));
}
