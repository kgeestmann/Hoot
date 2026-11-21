import { Routes } from '@angular/router';

import { Login } from './pages/login/login';
import { Profile } from './pages/profile/profile';
import { OverviewPage } from './pages/overview/overview';

import { authGuard } from './guards/auth-guard';
import { publicGuard } from './guards/public-guard';

export const routes: Routes = [

  {
    path: '',
    component: OverviewPage,
    canActivate: [authGuard]
  },

  {
    path: 'login',
    component: Login,
    canActivate: [publicGuard]
  },

  {
    path: 'profile',
    component: Profile,
    canActivate: [authGuard]
  }

];