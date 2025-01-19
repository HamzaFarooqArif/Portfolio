import { TestBed } from '@angular/core/testing';

import { MediaControlService } from './media-control.service';

describe('MediaControlService', () => {
  let service: MediaControlService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MediaControlService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
