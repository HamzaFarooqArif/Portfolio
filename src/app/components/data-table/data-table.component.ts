import { Component, OnInit } from '@angular/core';
import { SpreadsheetService as SpreadsheetService } from '../../services/spreadsheet/spreadsheet.service';
import { Papa } from 'ngx-papaparse';
import { Observable } from 'rxjs';
import { RowItem } from '../../models/row-item.model';
import { SpeechService } from '../../services/speech/speech.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PREFERRED_LANG_1, PREFERRED_LANG_2 } from '../../constants/constants';


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
    });

    this.speechService.getLangsAsync().subscribe((voices: SpeechSynthesisVoice[]) => {
      this.allVoices = voices;
      this.initializeDropdowns();
    });
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

  fetchDataAndParseAsync(): Observable<RowItem[]> {
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
    this.fetchDataAndParseAsync().subscribe((data: RowItem[]) => {
      this.tableData = data;
    }, err => {
      console.log(err);
    });
  }

  onSpeakButtonClick() {
    let voice: SpeechSynthesisVoice | undefined = this.getSpeechSynthesisVoice('lang1Voice');
    if(voice) {
      this.speechService.speakAsync('gehört', voice, 1).subscribe();
    }
  }

}
