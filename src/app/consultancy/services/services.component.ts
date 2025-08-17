import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { Papa } from 'ngx-papaparse';

@Component({
  selector: 'app-services',
  templateUrl: './services.component.html',
  styleUrl: './services.component.scss'
})
export class ServicesComponent {
  email = '';
  status: string | null = null;

  private sheetUrl = 'https://docs.google.com/spreadsheets/d/1xGyaanXXJJ8PMoT-CHFECiy8RzuX8iKyUBBJ8q9ZTKA/export?format=csv';
  
  constructor(private http: HttpClient, private papa: Papa,) {}

  checkStatus() {
    this.http.get(this.sheetUrl, { responseType: 'text' }).subscribe(csvData => {
      const parsed = this.papa.parse(csvData, { header: true });
      const rows: any[] = parsed.data as any[];

      // Assuming your sheet has "Email" and "Status" columns
      const match = rows.find(r => r['Email Address']?.toLowerCase() === this.email.toLowerCase());
      if(match) {
        if(match['Status']) {
          this.status = match['Status'];
        } else {
          this.status = 'Under Review';
        }
      } else {
        this.status =  'No record found';
      }
    });
  }

}
