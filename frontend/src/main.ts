import { inject, provideAppInitializer } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, TitleStrategy } from '@angular/router';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';

import { App } from './app/app';
import { DEMO_INTERCEPTORS } from './app/demo/demo-interceptors';
import { routes } from './app/app.routes';
import { provideIcons } from './app/icons';
import { AuthService } from './app/services/auth';
import { PageTitle } from './app/services/page-title';
import { sessionInterceptor } from './app/services/session-interceptor';

bootstrapApplication(App, {
  providers: [
    provideRouter(routes),
    { provide: TitleStrategy, useExisting: PageTitle },
    provideIcons(),
    provideHttpClient(withXhr(), withInterceptors([sessionInterceptor, ...DEMO_INTERCEPTORS])),
    // The sidenav shows Login or Profile, so the session has to be known before the first render.
    provideAppInitializer(() => inject(AuthService).loadSession()),
  ],
});
