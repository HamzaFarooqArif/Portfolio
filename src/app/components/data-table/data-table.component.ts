import { Component, OnInit } from '@angular/core';
import { SpreadsheetService as SpreadsheetService } from '../../services/spreadsheet/spreadsheet.service';
import { Papa } from 'ngx-papaparse';
import { Observable } from 'rxjs';
import { RowItem } from '../../models/row-item.model';
import { SpeechService } from '../../services/speech/speech.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ELIGIBLE_ROW_SYMBOL, PREFERRED_LANG_1, PREFERRED_LANG_2 } from '../../constants/constants';


@Component({
  selector: 'app-data-table',
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss'
})

export class DataTableComponent implements OnInit {
  playbackForm!: FormGroup;
  allVoices: SpeechSynthesisVoice[] = [];
  languages: { value: string; label: string }[] = [];
  lang1Voices: { value: string; label: string }[] = [];
  lang2Voices: { value: string; label: string }[] = [];
  highlightedRow: number | null = 1;
  highlightedCol: number | null = 1;

  constructor(
    private spreadsheetService: SpreadsheetService, 
    private papa: Papa,
    private speechService: SpeechService,
    private fb: FormBuilder) {}

  tableData: RowItem[] = [];

  ngOnInit(): void {
    this.fetchData();
    this.initForm();
    
  }

  initForm() {
    this.playbackForm = this.fb.group({
      lang1: ['', Validators.required],
      lang2: ['', Validators.required],
      lang1Voice: ['', Validators.required],
      lang2Voice: ['', Validators.required],
      startRow: ['', Validators.required],
      endRow: ['', Validators.required],
      vocalSpeed: [1],
      inbetweenDelay: [0],
      repeat: [true],
      reversePlayback: [false],
      reverseSpeechOrder: [false],
    });

    this.speechService.getLangsAsync().then((voices: SpeechSynthesisVoice[]) => {
      this.allVoices = voices;
      this.initializeDropdowns();
    });
  }

  patchForm() {
    if(this.tableData?.length) {
      this.playbackForm.get('startRow')?.setValue(1);
      this.playbackForm.get('endRow')?.setValue(this.tableData?.length - 1);
      this.playbackForm.get('startRow')?.setValidators([
        Validators.min(1),
        Validators.max(this.tableData?.length - 1)
      ]);
      this.playbackForm.get('endRow')?.setValidators([
        Validators.min(1),
        Validators.max(this.tableData?.length - 1)
      ]);
      this.playbackForm.get('startRow')?.updateValueAndValidity();
      this.playbackForm.get('endRow')?.updateValueAndValidity();
    }
  }

  initializeDropdowns() {
    Array.from(new Set(this.allVoices.map(item => item.lang))).forEach((item: string) => {
      this.languages.push(
        {
          value: item,
          label: item
        }
      );
    });

    let preferredLang1 = this.languages.find(x => {
      return PREFERRED_LANG_1.some((langItem: string) => langItem == x.value);
    })?.value ?? this.languages[0].value;
    let preferredLang2 = this.languages.find(x => {
      return PREFERRED_LANG_2.some((langItem: string) => langItem == x.value);
    })?.value ?? this.languages[0].value;
    this.playbackForm.get('lang1')?.setValue(preferredLang1);
    this.playbackForm.get('lang2')?.setValue(preferredLang2);
    this.refreshVoiceDropdown('lang1Voice');
    this.refreshVoiceDropdown('lang2Voice');
  }

  refreshVoiceDropdown(controlName: string) {
    switch (controlName) {
      case 'lang1Voice':
        {
          this.lang1Voices = [];
          let selectedLang: string | null = this.playbackForm.get('lang1')?.value;
          this.allVoices.forEach((voiceItem: SpeechSynthesisVoice) => {
            if(selectedLang?.toLowerCase() == voiceItem.lang.toLowerCase()) {
              let voiceItemForDropdown = {
                value: voiceItem.voiceURI,
                label: `${voiceItem.name} (${voiceItem.localService ? 'LOCAL' : 'CLOUD'})`
              };
              this.lang1Voices.push(voiceItemForDropdown);
            }
          });
          this.playbackForm.get('lang1Voice')?.setValue(this.lang1Voices[0].value);
          break;
        }
      case 'lang2Voice':
        {
          this.lang2Voices = [];
          let selectedLang: string | null = this.playbackForm.get('lang2')?.value;
          this.allVoices.forEach((voiceItem: SpeechSynthesisVoice) => {
            if(selectedLang?.toLowerCase() == voiceItem.lang.toLowerCase()) {
              let voiceItemForDropdown = {
                value: voiceItem.voiceURI,
                label: `${voiceItem.name} (${voiceItem.localService ? 'LOCAL' : 'CLOUD'})`
              };
              this.lang2Voices.push(voiceItemForDropdown);
            }
          });
          this.playbackForm.get('lang2Voice')?.setValue(this.lang2Voices[0].value);
          break;
        }
      default:
        break;
    }
  }

  getSpeechSynthesisVoice(controlName: string): SpeechSynthesisVoice | undefined {
    let voice: SpeechSynthesisVoice | undefined = this.allVoices.find((voiceItem: SpeechSynthesisVoice) => voiceItem.voiceURI == this.playbackForm.get(controlName)?.value);
    return voice;
  }

  async fetchDataAndParseAsync(): Promise<RowItem[]> {
    return new Promise((resolve, reject) => {
      this.spreadsheetService.getSheetData().subscribe((csvData: string) => {
        this.papa.parse(csvData, {
          skipEmptyLines: true,
          complete: (result) => {
            let filteredData = (result.data as any[]).filter((row: any) => row[2] == ELIGIBLE_ROW_SYMBOL);
            let parsedRows = filteredData.map((row: any) => ({
              first: row[0],
              second: row[1]
            })).filter(row => {
              return row.first.trim() !== '' || row.second.trim() !== '';
            });
  
            resolve(parsedRows);
          }
        });
      }, err => {
        reject(err);
      });
    });
  }

  fetchData() {
    this.fetchDataAndParseAsync().then((data: RowItem[]) => {
      this.tableData = data;
      this.patchForm();
    }, err => {
      console.log(err);
    });
  }

  isHighlighted(rowIndex: number, colIndex: number): boolean {
    return this.highlightedRow === rowIndex && this.highlightedCol === colIndex;
  }

  onSpeakButtonClick() {
    this.playAllTexts('lang1', 1);
  }

  highlightWord(langType: string, index: number) {
    this.highlightedRow = index;
    if(langType == 'lang1') {
      this.highlightedCol = 0;
    }
    else if(langType == 'lang2') {
      this.highlightedCol = 1;
    }
  }

  async playAllTexts(langType: string, currentIndex: number): Promise<void> {
    this.highlightWord(langType, currentIndex);
    let text = '';
    let voice: SpeechSynthesisVoice | undefined;
    if(langType == 'lang1') {
      text = this.tableData[currentIndex].first;
      voice = this.getSpeechSynthesisVoice('lang1Voice');
    }
    else if(langType == 'lang2') {
      text = this.tableData[currentIndex].second;
      voice = this.getSpeechSynthesisVoice('lang2Voice');
    }
    
    if(text && voice) {
      await this.speechService.speakAsync(text, voice);
    }

    if(currentIndex >= this.tableData?.length) {
      
    }
    else {
      if(langType == 'lang1') {
        return this.playAllTexts('lang2', currentIndex);
      }
      else {
        return this.playAllTexts('lang1', currentIndex + 1);
      }
    }
  }

}
