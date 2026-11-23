import { HttpInterceptorFn } from '@angular/common/http';

import { createDemoBackend, currentScenario } from './demo-backend';

/** The demo build plays the backend in the browser with made-up data (`npm run demo`). */
export const DEMO_INTERCEPTORS: HttpInterceptorFn[] = [
  createDemoBackend(currentScenario(window.location, window.sessionStorage), new Date()),
];
