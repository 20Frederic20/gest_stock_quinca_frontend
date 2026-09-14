export interface MenuItem {
  /** Text shown to the user. */
  label: string;
  route: string;
  /** true = working screen, false = "coming soon" page. */
  ready: boolean;
}

export interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export const MENU: MenuGroup[] = [
  { title: 'Pilotage', items: [
    { label: 'Tableau de bord', route: '/dashboard', ready: false },
  ]},
  { title: 'Ventes', items: [
    { label: 'Nouvelle vente',      route: '/new-sale',      ready: false },
    { label: 'Factures',            route: '/invoices',      ready: false },
    { label: 'Clients et créances', route: '/customers',     ready: false },
    { label: 'Historique',          route: '/sales-history', ready: false },
  ]},
  { title: 'Achats', items: [
    { label: 'Commandes fournisseurs', route: '/purchase-orders', ready: false },
    { label: 'Réceptions',             route: '/receptions',      ready: false },
    { label: 'Fournisseurs',           route: '/suppliers',       ready: false },
  ]},
  { title: 'Stock', items: [
    { label: 'État du stock', route: '/stock',           ready: false },
    { label: 'Mouvements',    route: '/stock-movements', ready: false },
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
    { label: 'Agences',              route: '/agencies',  ready: false },
    { label: 'Utilisateurs',         route: '/users',     ready: false },
    { label: 'Rôles et permissions', route: '/roles',     ready: false },
    { label: "Journal d'audit",      route: '/audit-log', ready: false },
  ]},
];
