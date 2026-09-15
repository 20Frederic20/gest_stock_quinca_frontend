import { Routes } from '@angular/router';
import { authGuard, guestGuard, permissionGuard } from './core/auth/auth.guards';
import { ComingSoonComponent } from './features/coming-soon/coming-soon.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

export const routes: Routes = [
  // Outside the frame: no sidebar nor header before logging in.
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      // --- Referential: real screens, plugged in one by one in the next steps ---
      {
        path: 'articles',
        loadComponent: () =>
          import('./features/articles/article-list.component').then(m => m.ArticleListComponent),
      },
      {
        path: 'families',
        loadComponent: () =>
          import('./features/families/family-list.component').then(m => m.FamilyListComponent),
      },
      {
        path: 'packagings',
        loadComponent: () =>
          import('./features/packagings/packaging-list.component').then(m => m.PackagingListComponent),
      },
      {
        path: 'units-of-measure',
        loadComponent: () =>
          import('./features/units-of-measure/unit-of-measure-list.component')
            .then(m => m.UnitOfMeasureListComponent),
      },
      {
        path: 'pricing',
        loadComponent: () =>
          import('./features/pricing/pricing-page.component').then(m => m.PricingPageComponent),
      },

      // --- Not exposed by the backend yet ---
      { path: 'dashboard',       component: ComingSoonComponent, data: { title: 'Tableau de bord' } },
      { path: 'new-sale',        component: ComingSoonComponent, data: { title: 'Nouvelle vente' } },
      { path: 'invoices',        component: ComingSoonComponent, data: { title: 'Factures' } },
      {
        path: 'customers',
        loadComponent: () =>
          import('./features/customers/customer-list.component').then(m => m.CustomerListComponent),
      },
      { path: 'sales-history',   component: ComingSoonComponent, data: { title: 'Historique des ventes' } },
      { path: 'purchase-orders', component: ComingSoonComponent, data: { title: 'Commandes fournisseurs' } },
      { path: 'receptions',      component: ComingSoonComponent, data: { title: 'Réceptions' } },
      { path: 'suppliers',       component: ComingSoonComponent, data: { title: 'Fournisseurs' } },
      {
        path: 'stock',
        loadComponent: () => import('./features/stock/stock-list.component').then(m => m.StockListComponent),
      },
      {
        path: 'stock-movements',
        loadComponent: () =>
          import('./features/stock-movements/movement-list.component').then(m => m.MovementListComponent),
      },
      { path: 'transfers',       component: ComingSoonComponent, data: { title: 'Transferts entre agences' } },
      { path: 'day-closing',     component: ComingSoonComponent, data: { title: 'Clôture de journée' } },
      { path: 'reports',         component: ComingSoonComponent, data: { title: 'Rapports et exports' } },
      {
        path: 'agencies',
        loadComponent: () =>
          import('./features/agencies/agency-list.component').then(m => m.AgencyListComponent),
      },
      {
        path: 'users',
        canActivate: [permissionGuard('users.manage')],
        loadComponent: () => import('./features/users/user-list.component').then(m => m.UserListComponent),
      },
      { path: 'roles',           component: ComingSoonComponent, data: { title: 'Rôles et permissions' } },
      { path: 'audit-log',       component: ComingSoonComponent, data: { title: "Journal d'audit" } },

      { path: '**', component: ComingSoonComponent, data: { title: 'Page introuvable' } },
    ],
  },
];
