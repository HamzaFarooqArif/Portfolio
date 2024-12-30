import { Component, OnInit } from '@angular/core';
import { VocabularyItem } from '../../models/vocabulary-item.model';

@Component({
  selector: 'app-vocabulary-table',
  templateUrl: './vocabulary-table.component.html',
  styleUrl: './vocabulary-table.component.scss'
})
export class VocabularyTableComponent implements OnInit {

  words: VocabularyItem[] = [
    { word: 'wer', meaning: 'who' },
    { word: 'wie', meaning: 'how' },
    { word: 'kennen Sie', meaning: 'do you know' },
    { word: 'gegenüber', meaning: 'opposite' },
    { word: 'bekannte', meaning: 'famous' },
    // ... and so on
  ];

  ngOnInit(): void {
      
  }

}
