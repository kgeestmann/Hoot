import { Routes } from '@angular/router';

import { Login } from './pages/login/login';
import { Profile } from './pages/profile/profile';
import { Home } from './pages/home/home';

import { authGuard } from './guards/auth-guard';
import { publicGuard } from './guards/public-guard';

export const routes: Routes = [

  {
    path: '',
    component: Home
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