import { Component, OnInit } from '@angular/core';
import { SpreadsheetService as SpreadsheetService } from '../../services/spreadsheet/spreadsheet.service';
import { Papa } from 'ngx-papaparse';
import { Observable } from 'rxjs';
import { RowItem } from '../../models/row-item.model';
import { SpeechService } from '../../services/speech/speech.service';


@Component({
  selector: 'app-data-table',
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss'
})

export class DataTableComponent implements OnInit {

  constructor(
    private spreadsheetService: SpreadsheetService, 
    private papa: Papa,
    private speechService: SpeechService) {}

  tableData: RowItem[] = [];

  ngOnInit(): void {
    this.fetchData();
  }

  onSpeakButtonClick() {
    this.speechService.speak().subscribe();
  }

  fetchDataAndParse(): Observable<RowItem[]> {
    return new Observable<RowItem[]>((observer) => {
      this.spreadsheetService.getSheetData().subscribe((csvData: string) => {
        this.papa.parse(csvData, {
          skipEmptyLines: true,
          complete: (result) => {
            let parsedRows = (result.data as any[]).map((row: any) => ({
              first: row[0],
              second: row[1]
            })).filter(row => {
              return row.first.trim() !== '' || row.second.trim() !== '';
            });

            observer.next(parsedRows);
            observer.complete();
          }
        });
      }, err => {
        observer.error(err);
      });
    });
  }

  fetchData() {
    this.fetchDataAndParse().subscribe((data: RowItem[]) => {
      this.tableData = data;
    }, err => {
      console.log(err);
    });
  }

}
