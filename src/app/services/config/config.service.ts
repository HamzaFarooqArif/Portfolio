import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {

  private config: any;

  constructor(private http: HttpClient) {}

  loadConfig(): Observable<any> {
    return this.http.get('/assets/app-config.json');
  }

  setConfig(config: any): void {
    this.config = config;
  }

  getConfig(): any {
    return this.config;
  }

  getConfigValue(key: string): any {
    return this.config ? this.config[key] : null;
  }
}
