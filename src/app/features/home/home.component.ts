import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

/**
 * Page publique d'accueil — vitrine Trinity JJP, ouverte à tous : visiteurs comme utilisateurs connectés.
 * Elle s'affiche sans attendre la vérification de la session ; le lien d'entrée s'adapte dès qu'elle est connue.
 */
@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  private auth = inject(AuthService);

  /** Un utilisateur connecté entre directement dans l'application. */
  loggedIn = computed(() => this.auth.user() !== null);
}
