import { Component, OnInit } from '@angular/core';
import { SpreadsheetService as SpreadsheetService } from '../../services/spreadsheet/spreadsheet.service';
import { Papa } from 'ngx-papaparse';
import { Observable } from 'rxjs';
import { SpeechService } from '../../services/speech/speech.service';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ELIGIBLE_ROW_SYMBOL, PREFERRED_LANGS } from '../../constants/constants';
import { ConfigService } from '../../services/config/config.service';


@Component({
  selector: 'app-data-table',
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss'
})

export class DataTableComponent implements OnInit {
  numberOfLanguages: number = 0; 
  playbackForm!: FormGroup;
  allVoices: SpeechSynthesisVoice[] = [];
  masterLanguages: { value: string; label: string }[] = [];
  populatedVoicesData: { value: string; label: string }[][] = [];
  highlightedRow: number | null = -1;
  highlightedCol: number | null = -1;

  constructor(
    private spreadsheetService: SpreadsheetService,
    private configService: ConfigService,
    private papa: Papa,
    private speechService: SpeechService,
    private fb: FormBuilder) {}

  tableData: string[][] = [];

  ngOnInit(): void {
    this.numberOfLanguages = Number(this.configService.getConfigValue('numberOfLanguages'));
    this.fetchData();
    this.initForm();
    
  }

  initForm() {
    this.playbackForm = this.fb.group({
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

    for (let i = 0; i < this.numberOfLanguages; i++) {
      this.playbackForm.addControl(`lang${i+1}`, this.fb.control('', Validators.required));
      this.playbackForm.addControl(`lang${i+1}Voice`, this.fb.control('', Validators.required));
    }
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
      this.masterLanguages.push(
        {
          value: item,
          label: item
        }
      );
    });

    for(let i = 0; i < this.numberOfLanguages; i++) {
      let preferredLang = this.masterLanguages.find(x => {
        return PREFERRED_LANGS?.length > i && PREFERRED_LANGS[i].some((langItem: string) => langItem == x.value);
      })?.value ?? this.masterLanguages[0].value;
      this.playbackForm.get(`lang${i+1}`)?.setValue(preferredLang);
      this.refreshVoiceDropdown(i+1);
    }
  }

  refreshVoiceDropdown(controlIndex: number) {
    if(!this.populatedVoicesData?.length || this.populatedVoicesData?.length < controlIndex) {
      this.populatedVoicesData.push([]);
    }
    this.populatedVoicesData[controlIndex-1] = [];
    let selectedLang: string | null = this.playbackForm.get(`lang${controlIndex}`)?.value;
    this.allVoices.forEach((voiceItem: SpeechSynthesisVoice) => {
      if(selectedLang?.toLowerCase() == voiceItem.lang.toLowerCase()) {
        let voiceItemForDropdown = {
          value: voiceItem.voiceURI,
          label: `${voiceItem.name} (${voiceItem.localService ? 'LOCAL' : 'CLOUD'})`
        };
        this.populatedVoicesData[controlIndex-1].push(voiceItemForDropdown);
      }
    });
    this.playbackForm.get(`lang${controlIndex}Voice`)?.setValue(this.populatedVoicesData[controlIndex-1][0].value);
  }

  getSpeechSynthesisVoice(controlName: string): SpeechSynthesisVoice | undefined {
    let voice: SpeechSynthesisVoice | undefined = this.allVoices.find((voiceItem: SpeechSynthesisVoice) => voiceItem.voiceURI == this.playbackForm.get(controlName)?.value);
    return voice;
  }

  async fetchDataAndParseAsync(): Promise<string[][]> {
    return new Promise((resolve, reject) => {
      this.spreadsheetService.getSheetData().subscribe((csvData: string) => {
        this.papa.parse(csvData, {
          complete: (result) => {
            let filteredData = (result.data as any[]).filter((row: any, index: number) => {
              return index == 0 || row[this.numberOfLanguages] == ELIGIBLE_ROW_SYMBOL;
            });
            let parsedRows = filteredData.map((row: any) => (
              row.slice(0, this.numberOfLanguages)
              )).filter((row: string[]) => {
              return row.every(el => el != "");
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
    this.fetchDataAndParseAsync().then((data: string[][]) => {
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
    this.playAllTexts(1, 0);
  }

  highlightWord(row: number, col: number) {
    this.highlightedRow = row;
    this.highlightedCol = col;
  }

  async playAllTexts(rowIndex: number, colIndex: number): Promise<void> {
    this.highlightWord(rowIndex-1, colIndex);
    let text = this.tableData[rowIndex][colIndex];
    let voice: SpeechSynthesisVoice | undefined = this.getSpeechSynthesisVoice(`lang${colIndex + 1}Voice`);
    
    if(text && voice) {
      await this.speechService.speakAsync(text, voice);
    }

    if(rowIndex >= this.tableData?.length) {
      
    }
    else {
      if(colIndex < this.tableData[0]?.length) {
        return this.playAllTexts(rowIndex, colIndex + 1);
      }
      else {
        return this.playAllTexts(rowIndex + 1, 0);
      }
    }
  }

}
