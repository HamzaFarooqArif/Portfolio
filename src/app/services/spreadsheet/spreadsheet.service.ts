import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigService } from '../config/config.service';

@Injectable({
  providedIn: 'root'
})
export class SpreadsheetService {

  constructor(private http: HttpClient, private config: ConfigService) { }

  getSheetData(): Observable<string> {
    const csvUrl = this.config.getConfigValue("googleSheetsUrl").replace("<googleSheetsId>", this.config.getConfigValue("googleSheetsId"));
    return this.http.get(csvUrl, { responseType: 'text' });
  }
}
