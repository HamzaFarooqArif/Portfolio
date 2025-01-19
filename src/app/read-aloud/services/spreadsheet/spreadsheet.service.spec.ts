import { TestBed } from '@angular/core/testing';
import { HttpClientModule } from '@angular/common/http';
import { SpreadsheetService } from './spreadsheet.service';

describe('SpreadsheetService', () => {
  let service: SpreadsheetService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientModule],
      providers: [SpreadsheetService],
    });
    service = TestBed.inject(SpreadsheetService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
