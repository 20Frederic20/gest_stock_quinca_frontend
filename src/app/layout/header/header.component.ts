import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE_LABELS } from '../../core/models/user.model';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  user = this.auth.user;
  roleLabel = computed(() => {
    const user = this.user();
    return user ? ROLE_LABELS[user.role] : '';
  });

  loggingOut = signal(false);

  today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  logout(): void {
    this.loggingOut.set(true);
    this.auth
      .logout()
      // Back to the login page even if the server could not be reached: the user is forgotten here anyway.
      .pipe(finalize(() => void this.router.navigateByUrl('/login')))
      .subscribe({ error: () => undefined });
  }
}
