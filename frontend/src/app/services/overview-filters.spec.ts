import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { API_URL } from '../api';
import { OverviewFilters, OverviewFiltersService } from './overview-filters';

describe('OverviewFiltersService', () => {
  let service: OverviewFiltersService;
  let http: HttpTestingController;
  const FILTERS: OverviewFilters = { hidden: ['octo-org'], labels: ['bug'] };

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

  it('loads the filters', () => {
    let loaded: OverviewFilters | undefined;

    service.load().subscribe((result) => (loaded = result));
    http.expectOne(`${API_URL}/overview/filters`).flush(FILTERS);

    expect(loaded).toEqual(FILTERS);
  });

  it('saves the filters with PUT', () => {
    service.save(FILTERS).subscribe();

    const request = http.expectOne({ method: 'PUT', url: `${API_URL}/overview/filters` });
    request.flush(FILTERS);

    expect(request.request.body).toEqual(FILTERS);
  });
});
