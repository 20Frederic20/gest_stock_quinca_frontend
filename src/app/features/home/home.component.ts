import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Page publique d'accueil (visiteurs non connectés) — vitrine Trinity JJP avant connexion. */
@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {}
