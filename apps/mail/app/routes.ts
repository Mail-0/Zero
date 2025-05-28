import { type RouteConfig, index, layout, prefix, route } from '@react-router/dev/routes';

export default [
  index('page.tsx'),
  route('/home', 'home/page.tsx'),

  route('/manifest.webmanifest', 'meta-files/manifest.ts'),
  route(
    '/.well-known/microsoft-identity-association',
    'meta-files/microsoft-identity-association.ts',
  ),
  route(
    '/.well-known/microsoft-identity-association.json',
    'meta-files/microsoft-identity-association.json.ts',
  ),
  route('/api/mailto-handler', 'mailto-handler.ts'),
  route('/og-api/home', 'og-api/home.tsx'),
  route('/og-api/create', 'og-api/create.tsx'),

  layout('(full-width)/layout.tsx', [
    route('/about', '(full-width)/about.tsx'),
    route('/terms', '(full-width)/terms.tsx'),
    route('/pricing', '(full-width)/pricing.tsx'),
    route('/privacy', '(full-width)/privacy.tsx'),
    route('/contributors', '(full-width)/contributors.tsx'),
  ]),

  route('/login', '(auth)/login/page.tsx'),

  // Enable this when we have a zero signup page
  // route('/zero/signup', '(auth)/zero/signup/page.tsx'),
  // route('/zero/login', '(auth)/zero/login/page.tsx'),

  layout('(routes)/layout.tsx', [
    route('/developer', '(routes)/developer/page.tsx'),
    route('/toast-test', '(routes)/toast-test.tsx'),
    layout(
      '(routes)/mail/layout.tsx',
      prefix('/mail', [
        index('(routes)/mail/page.tsx'),
        route('/create', '(routes)/mail/create/page.tsx'),
        route('/compose', '(routes)/mail/compose/page.tsx'),
        route('/under-construction/:path', '(routes)/mail/under-construction/[path]/page.tsx'),
        route('/:folder', '(routes)/mail/[folder]/page.tsx'),
      ]),
    ),
    layout(
      '(routes)/settings/layout.tsx',
      prefix('/settings', [
        index('(routes)/settings/page.tsx'),
        route('/appearance', '(routes)/settings/appearance/page.tsx'),
        route('/connections', '(routes)/settings/connections/page.tsx'),
        route('/danger-zone', '(routes)/settings/danger-zone/page.tsx'),
        route('/general', '(routes)/settings/general/page.tsx'),
        route('/labels', '(routes)/settings/labels/page.tsx'),
        route('/notifications', '(routes)/settings/notifications/page.tsx'),
        route('/privacy', '(routes)/settings/privacy/page.tsx'),
        route('/security', '(routes)/settings/security/page.tsx'),
        route('/shortcuts', '(routes)/settings/shortcuts/page.tsx'),
        route('/*', '(routes)/settings/[...settings]/page.tsx'),
      ]),
    ),
  ]),

  // 404 page
  route('/*', 'meta-files/not-found.ts'),
] satisfies RouteConfig;
