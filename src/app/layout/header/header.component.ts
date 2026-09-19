import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE_LABELS } from '../../core/models/user.model';

/** "Awa Dossou" → "AD". One letter when there is only one word. */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase() ?? '')
    .join('');
}

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
  host: {
    '(document:keydown.escape)': 'close()',
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class HeaderComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  user = this.auth.user;
  roleLabel = computed(() => {
    const user = this.user();
    return user ? ROLE_LABELS[user.role] : '';
  });
  initials = computed(() => initialsOf(this.user()?.name ?? ''));

  /** The user menu: who is logged in, and the way out. */
  menuOpen = signal(false);
  loggingOut = signal(false);

  today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  toggleMenu(event: Event): void {
    // Without this the document listener below would close it in the same breath.
    event.stopPropagation();
    this.menuOpen.update(open => !open);
  }

  close(): void {
    this.menuOpen.set(false);
  }

  /** A click anywhere else closes the menu, as a menu should. */
  onDocumentClick(event: Event): void {
    if (this.menuOpen()) this.close();
    void event;
  }

  logout(): void {
    this.loggingOut.set(true);
    this.auth
      .logout()
      // Back to the login page even if the server could not be reached: the user is forgotten here anyway.
      .pipe(finalize(() => void this.router.navigateByUrl('/login')))
      .subscribe({ error: () => undefined });
  }
}
