import { Routes } from '@angular/router';

import { authGuard } from './guards/auth-guard';
import { publicGuard } from './guards/public-guard';

// Pages load on demand, so the first download only holds the app shell.
export const routes: Routes = [

  {
    path: '',
    title: 'Overview',
    loadComponent: () => import('./pages/overview/overview').then((page) => page.OverviewPage),
    canActivate: [authGuard]
  },

  {
    path: 'orgs/:organization',
    title: (route) => route.paramMap.get('organization') ?? 'Team view',
    loadComponent: () =>
      import('./pages/organization/organization').then((page) => page.OrganizationPage),
    canActivate: [authGuard]
  },

  {
    path: 'login',
    title: 'Sign in',
    loadComponent: () => import('./pages/login/login').then((page) => page.Login),
    canActivate: [publicGuard]
  },

  {
    path: 'profile',
    title: 'Profile',
    loadComponent: () => import('./pages/profile/profile').then((page) => page.Profile),
    canActivate: [authGuard]
  }

];