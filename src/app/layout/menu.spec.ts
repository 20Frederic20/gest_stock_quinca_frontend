import { MENU, MenuGroup, visibleMenu } from './menu';
import { routes } from '../app.routes';
import { MainLayoutComponent } from './main-layout/main-layout.component';

describe('visibleMenu', () => {
  const menu: MenuGroup[] = [
    { title: 'Référentiel', items: [{ label: 'Articles', route: '/articles', ready: true }] },
    { title: 'Administration', items: [
      { label: 'Agences', route: '/agencies', ready: true },
      { label: 'Utilisateurs', route: '/users', ready: true, permission: 'users.manage' },
    ]},
    { title: 'Secret', items: [{ label: 'Réservé', route: '/secret', ready: true, permission: 'users.manage' }] },
  ];

  it('keeps every entry for a user allowed everything', () => {
    expect(visibleMenu(menu, () => true)).toEqual(menu);
  });

  it('removes the entries the user may not open, and the groups left empty', () => {
    const visible = visibleMenu(menu, () => false);

    expect(visible.map(g => g.title)).toEqual(['Référentiel', 'Administration']);
    expect(visible[1].items.map(i => i.route)).toEqual(['/agencies']);
  });

  it('reserves users management to the administrators in the real menu', () => {
    const users = MENU.flatMap(g => g.items).find(i => i.route === '/users');

    expect(users?.permission).toBe('users.manage');
  });

  it('reserves the day closing screen to the roles who hold the till', () => {
    const dayClosing = MENU.flatMap(g => g.items).find(i => i.route === '/day-closing');

    expect(dayClosing?.permission).toBe('dayClosing.access');
  });

  it('reserves the achats screens to managers and administrators, hidden from a seller', () => {
    const achats = MENU.find(g => g.title === 'Achats')!;

    expect(achats.items.map(i => i.permission)).toEqual([
      'purchases.write',
      'purchases.write',
      'suppliers.write',
    ]);
  });
});

describe('MENU', () => {
  const layoutRoute = routes.find(route => route.component === MainLayoutComponent);
  const declaredPaths = (layoutRoute?.children ?? []).map(route => '/' + route.path);
  const allItems = MENU.flatMap(group => group.items);

  it('has 8 groups', () => {
    expect(MENU.length).toBe(8);
  });

  it('has 23 items', () => {
    expect(allItems.length).toBe(23);
  });

  it('starts a sale from the invoices screen, which has its own button, not from a menu entry', () => {
    expect(allItems.map(item => item.route)).not.toContain('/new-sale');
  });

  it('only points to routes that are declared', () => {
    for (const item of allItems) {
      expect(declaredPaths).toContain(item.route);
    }
  });

  it('marks exactly the ready screens, day closing included', () => {
    const readyRoutes = allItems.filter(item => item.ready).map(item => item.route);

    expect(readyRoutes.sort()).toEqual(
      ['/agencies', '/articles', '/customers', '/dashboard', '/day-closing', '/deliveries', '/families', '/invoices', '/packagings', '/payments', '/pricing', '/purchase-orders', '/receptions', '/stock', '/stock-movements', '/suppliers', '/units-of-measure', '/users'],
    );
  });
});
