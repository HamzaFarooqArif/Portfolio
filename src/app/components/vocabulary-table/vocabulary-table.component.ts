import { Component, OnInit } from '@angular/core';
import { VocabularyItem } from '../../models/vocabulary-item.model';
import { GoogleSheetServiceService } from '../../services/google-sheet-service/google-sheet-service.service';
import { Papa } from 'ngx-papaparse';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-vocabulary-table',
  templateUrl: './vocabulary-table.component.html',
  styleUrl: './vocabulary-table.component.scss'
})

export class VocabularyTableComponent implements OnInit {

  constructor(private googleSheetServiceService: GoogleSheetServiceService, private papa: Papa) {}

  words: VocabularyItem[] = [];

  ngOnInit(): void {
    this.fetchData();
  }

  fetchDataAndParse(): Observable<VocabularyItem[]> {
    return new Observable<VocabularyItem[]>((observer) => {
      this.googleSheetServiceService.getSheetData().subscribe((csvData: string) => {
        this.papa.parse(csvData, {
          skipEmptyLines: true,
          complete: (result) => {
            let parsedWords = (result.data as any[]).map((row: any) => ({
              word: row[0],
              meaning: row[1]
            })).filter(row => {
              return row.word.trim() !== '' || row.meaning.trim() !== '';
            });

            observer.next(parsedWords);
            observer.complete();
          }
        });
      }, err => {
        observer.error(err);
      });
    });
  }

  fetchData() {
    this.fetchDataAndParse().subscribe((data: VocabularyItem[]) => {
      this.words = data;
    }, err => {
      console.log(err);
    });
  }

}
