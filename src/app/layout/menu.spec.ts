import { MENU } from './menu';
import { routes } from '../app.routes';

describe('MENU', () => {
  const declaredPaths = (routes[0].children ?? []).map(route => '/' + route.path);
  const allItems = MENU.flatMap(group => group.items);

  it('has 8 groups', () => {
    expect(MENU.length).toBe(8);
  });

  it('has 22 items', () => {
    expect(allItems.length).toBe(22);
  });

  it('only points to routes that are declared', () => {
    for (const item of allItems) {
      expect(declaredPaths).toContain(item.route);
    }
  });

  it('marks exactly the 5 referential screens as ready', () => {
    const readyRoutes = allItems.filter(item => item.ready).map(item => item.route);

    expect(readyRoutes.sort()).toEqual(
      ['/articles', '/families', '/packagings', '/pricing', '/units-of-measure'],
    );
  });
});
