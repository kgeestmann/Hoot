import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { API_URL } from '../api';
import { OrganizationsService } from './organizations';

describe('OrganizationsService', () => {
  it('loads the team view of an organization', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);

    TestBed.inject(OrganizationsService).load('octo-org').subscribe();

    http.expectOne(`${API_URL}/orgs/octo-org/overview`).flush({});
    http.verify();
  });
});
