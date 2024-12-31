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
  currentRow: number = 1;
  currentColumn: number = 0;

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

  reverseChanged() {
    let reverse: boolean = this.playbackForm?.get('reversePlayback')?.value;
    let startRow = Number(this.playbackForm.get('startRow')?.value);
    let endRow = Number(this.playbackForm.get('endRow')?.value);
    if(reverse) {
      if(startRow <= endRow) {
        let temp = startRow;
        this.playbackForm.get('startRow')?.setValue(endRow);
        this.playbackForm.get('endRow')?.setValue(temp);
      }
    }
    else {
      if(startRow >= endRow) {
        let temp = startRow;
        this.playbackForm.get('startRow')?.setValue(endRow);
        this.playbackForm.get('endRow')?.setValue(temp);
      }
    }
  }

  isHighlighted(rowIndex: number, colIndex: number): boolean {
    return this.highlightedRow === rowIndex && this.highlightedCol === colIndex;
  }

  playClick() {
    this.playbackForm.get('startRow')?.disable();
    this.playbackForm.get('endRow')?.disable();
    this.currentRow = Number(this.playbackForm.get('startRow')?.value);
    let reverseSpeechOrder: boolean = this.playbackForm?.get('reverseSpeechOrder')?.value;
    if(reverseSpeechOrder) {
      this.currentColumn = this.tableData[0]?.length - 1;
    }
    else {
      this.currentColumn = 0;
    }
    this.playAllTexts();
  }

  stopClick() {
    this.playbackForm.get('startRow')?.enable();
    this.playbackForm.get('endRow')?.enable();
    this.highlightWord(-1, -1);
    this.speechService.stopSpeech();
  }

  highlightWord(row: number, col: number) {
    this.highlightedRow = row;
    this.highlightedCol = col;
  }

  async playAllTexts(): Promise<void> {
    if(this.speechTerminationCriteria()) {
      this.highlightWord(this.currentRow-1, this.currentColumn);
      let text = this.tableData[this.currentRow][this.currentColumn];
      let voice: SpeechSynthesisVoice | undefined = this.getSpeechSynthesisVoice(`lang${this.currentColumn + 1}Voice`);
      let vocalSpeed = Number(this.playbackForm?.get('vocalSpeed')?.value);
      if(text && voice) {
        await this.speechService.speakAsync(text, voice, vocalSpeed);
      }
      if(this.currentColumn < this.tableData[0]?.length) {
        if(this.currentColumn == 0) {
          let delay = Number(this.playbackForm.get('inbetweenDelay')?.value);
          let timeout = setTimeout(() => {
            clearTimeout(timeout);
            this.setNextCell();
            return this.playAllTexts();
          }, delay*1000);
        }
        else {
          this.setNextCell();
          return this.playAllTexts();
        }
      }
      else {
        this.setNextCell();
        return this.playAllTexts();
      }
    }
    else {
      let repeat = this.playbackForm?.get('repeat')?.value;
      if(repeat) {
        this.playClick();
      }
      else {
        this.highlightWord(-1, -1);
        this.playbackForm.get('startRow')?.enable();
        this.playbackForm.get('endRow')?.enable();
        return;
      }
    }
  }

  setNextCell() {
    let reverse: boolean = this.playbackForm?.get('reversePlayback')?.value;
    let reverseSpeechOrder: boolean = this.playbackForm?.get('reverseSpeechOrder')?.value;

    if(reverse) {
      if(reverseSpeechOrder) {
        if(this.currentColumn == 0) {
          this.currentColumn = this.tableData[0]?.length - 1;
          this.currentRow -= 1;
        }
        else {
          this.currentColumn -= 1;
        }
      }
      else {
        if(this.currentColumn == this.tableData[0]?.length - 1) {
          this.currentColumn = 0;
          this.currentRow -= 1;  
        }
        else {
          this.currentColumn += 1;
        }
      }
    }
    else {
      if(reverseSpeechOrder) {
        if(this.currentColumn == 0) {
          this.currentColumn = this.tableData[0]?.length - 1;
          this.currentRow += 1;  
        }
        else {
          this.currentColumn -= 1;
        }
      }
      else {
        if(this.currentColumn == this.tableData[0]?.length - 1) {
          this.currentColumn = 0;
          this.currentRow += 1;  
        }
        else {
          this.currentColumn += 1;
        }
      }
    }
  }

  speechTerminationCriteria(): boolean {
    let reverse: boolean = this.playbackForm?.get('reversePlayback')?.value;
    let startRowInputVal: number = Number(this.playbackForm?.get('startRow')?.value);
    let endRowInputVal: number = Number(this.playbackForm?.get('endRow')?.value);
    if(reverse) {
      return this.currentRow > 0 && (startRowInputVal > endRowInputVal && this.currentRow >= endRowInputVal);
    }
    else {
      return this.currentRow < this.tableData?.length && (startRowInputVal < endRowInputVal && this.currentRow <= endRowInputVal);
    }
  }

}
