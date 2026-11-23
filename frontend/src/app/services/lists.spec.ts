import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { API_URL } from '../api';
import { ListsService } from './lists';

describe('ListsService', () => {
  let service: ListsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ListsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads the first page of a list in the given order', () => {
    service.load('mentions', 'oldest').subscribe();

    http.expectOne(`${API_URL}/lists/mentions?sort=oldest`).flush({});
  });

  it('continues after a cursor', () => {
    service.load('assigned_issues', 'updated', 'Y3Vyc29yOjUw').subscribe();

    http.expectOne(`${API_URL}/lists/assigned_issues?sort=updated&after=Y3Vyc29yOjUw`).flush({});
  });
});
