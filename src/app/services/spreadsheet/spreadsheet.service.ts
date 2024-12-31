import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { GOOGLE_SHEETS_URL } from '../../constants/constants';

@Injectable({
  providedIn: 'root'
})
export class SpreadsheetService {

  constructor(private http: HttpClient) { }

  getSheetData(): Observable<string> {
    const csvUrl = GOOGLE_SHEETS_URL;
    return this.http.get(csvUrl, { responseType: 'text' });
  }
}
