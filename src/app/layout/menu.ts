import { Permission } from '../core/auth/permissions';

export interface MenuItem {
  /** Text shown to the user. */
  label: string;
  route: string;
  /** true = working screen, false = "coming soon" page. */
  ready: boolean;
  /** Only shown to the users holding it. No permission = every logged-in user. */
  permission?: Permission;
}

export interface MenuGroup {
  title: string;
  items: MenuItem[];
}

/** The menu a user sees: entries they may not open are removed, then the groups left empty. */
export function visibleMenu(menu: MenuGroup[], can: (permission: Permission) => boolean): MenuGroup[] {
  return menu
    .map(group => ({ ...group, items: group.items.filter(item => !item.permission || can(item.permission)) }))
    .filter(group => group.items.length > 0);
}

export const MENU: MenuGroup[] = [
  { title: 'Pilotage', items: [
    { label: 'Tableau de bord', route: '/dashboard', ready: false },
  ]},
  { title: 'Ventes', items: [
    { label: 'Factures',            route: '/invoices',      ready: true },
    { label: 'Clients et créances', route: '/customers',     ready: true },
    { label: 'Historique',          route: '/sales-history', ready: false },
  ]},
  { title: 'Achats', items: [
    { label: 'Commandes fournisseurs', route: '/purchase-orders', ready: false },
    { label: 'Réceptions',             route: '/receptions',      ready: false },
    { label: 'Fournisseurs',           route: '/suppliers',       ready: false },
  ]},
  { title: 'Stock', items: [
    { label: 'État du stock', route: '/stock',           ready: true },
    { label: 'Mouvements',    route: '/stock-movements', ready: true },
    { label: 'Transferts',    route: '/transfers',       ready: false },
  ]},
  { title: 'Référentiel', items: [
    { label: 'Articles',             route: '/articles',         ready: true },
    { label: 'Familles',             route: '/families',         ready: true },
    { label: 'Conditionnements',     route: '/packagings',       ready: true },
    { label: 'Unités de mesure',     route: '/units-of-measure', ready: true },
    { label: 'Tarifs et privilèges', route: '/pricing',          ready: true },
  ]},
  { title: 'Caisse', items: [
    { label: 'Clôture de journée', route: '/day-closing', ready: false },
  ]},
  { title: 'Analyse', items: [
    { label: 'Rapports et exports', route: '/reports', ready: false },
  ]},
  { title: 'Administration', items: [
    { label: 'Agences',              route: '/agencies',  ready: true },
    { label: 'Utilisateurs',         route: '/users',     ready: true, permission: 'users.manage' },
    { label: 'Rôles et permissions', route: '/roles',     ready: false },
    { label: "Journal d'audit",      route: '/audit-log', ready: false },
  ]},
];
