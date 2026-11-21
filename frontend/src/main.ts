import { inject, provideAppInitializer } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';

import { App } from './app/app';
import { routes } from './app/app.routes';
import { AuthService } from './app/services/auth';
import { sessionInterceptor } from './app/services/session-interceptor';

bootstrapApplication(App, {
  providers: [
    provideRouter(routes),
    provideHttpClient(withXhr(), withInterceptors([sessionInterceptor])),
    // The sidenav shows Login or Profile, so the session has to be known before the first render.
    provideAppInitializer(() => inject(AuthService).loadSession()),
  ],
});
