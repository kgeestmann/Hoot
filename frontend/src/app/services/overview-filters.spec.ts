import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { API_URL } from '../api';
import { OverviewFiltersService } from './overview-filters';

describe('OverviewFiltersService', () => {
  let service: OverviewFiltersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OverviewFiltersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads the hidden scopes', () => {
    let hidden: string[] | undefined;

    service.load().subscribe((result) => (hidden = result));
    http.expectOne(`${API_URL}/overview/filters`).flush({ hidden: ['octo-org'] });

    expect(hidden).toEqual(['octo-org']);
  });

  it('saves the hidden scopes with PUT', () => {
    let saved: string[] | undefined;

    service.save(['kgeestmann/hoot']).subscribe((result) => (saved = result));
    const request = http.expectOne({ method: 'PUT', url: `${API_URL}/overview/filters` });
    request.flush({ hidden: ['kgeestmann/hoot'] });

    expect(request.request.body).toEqual({ hidden: ['kgeestmann/hoot'] });
    expect(saved).toEqual(['kgeestmann/hoot']);
  });
});
