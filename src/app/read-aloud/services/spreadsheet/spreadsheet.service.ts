import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigService } from '../config/config.service';

@Injectable({
  providedIn: 'root'
})
export class SpreadsheetService {

  private sheetId: string = "";
  private subSheetId: string = "";

  constructor(private http: HttpClient, private config: ConfigService) { }

  setSheetId(value: string) {
    this.sheetId = value;
  }

  setSubSheetId(value: string) {
    this.subSheetId = value ? value : '0';
  }

  fetchSheetData(): Observable<string> {
    if(!this.sheetId) {
      this.sheetId = this.config.getConfigValue("googleSheetsId");
    }
    const csvUrl = this.config.getConfigValue("googleSheetsUrl")
                    .replace("<googleSheetsId>", this.sheetId)
                    .replace("<googleSheetsId>", this.sheetId)
                    .replace("<googleSubSheetsId>", this.subSheetId);
    return this.http.get(csvUrl, { responseType: 'text' });
  }
}
