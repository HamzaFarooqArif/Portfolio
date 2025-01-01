import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigService } from '../config/config.service';

@Injectable({
  providedIn: 'root'
})
export class SpreadsheetService {

  private sheetId: string = "";

  constructor(private http: HttpClient, private config: ConfigService) { }

  setSheetId(value: string) {
    this.sheetId = value;
  }

  fetchSheetData(): Observable<string> {
    if(!this.sheetId) {
      this.sheetId = this.config.getConfigValue("googleSheetsId");
    }
    const csvUrl = this.config.getConfigValue("googleSheetsUrl").replace("<googleSheetsId>", this.sheetId);
    return this.http.get(csvUrl, { responseType: 'text' });
  }
}
