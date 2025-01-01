import { Component, OnInit } from '@angular/core';
import { SpreadsheetService as SpreadsheetService } from '../../services/spreadsheet/spreadsheet.service';
import { Papa } from 'ngx-papaparse';
import { SpeechService } from '../../services/speech/speech.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ALLLANGUAGES } from '../../constants/constants';
import { ConfigService } from '../../services/config/config.service';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { isEmpty } from '../../Utilities/Utility';


@Component({
  selector: 'app-data-table',
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss'
})

export class DataTableComponent implements OnInit {
  loading: boolean = false;
  numberOfLanguages: number = 0; 
  playbackForm!: FormGroup;
  allVoices: SpeechSynthesisVoice[] = [];
  masterLanguages: { value: string; label: string }[] = [];
  populatedVoicesData: { value: string; label: string }[][] = [];
  highlightedRow: number | null = -1;
  highlightedCol: number | null = -1;
  currentRow: number = 1;
  currentColumn: number = 0;
  playbackButtonsStatus: {name: string, visible: boolean, disabled: boolean}[] = [];
  isSpeaking: boolean = false;
  isStopped: boolean = true;
  formQueryParams: Params | null | undefined;
  vocalSpeedRange: {min: number, max: number} = {min: 0.1, max: 2};
  inbetweenDelayRange: {min: number, max: number} = {min: 0, max: 3};

  constructor(
    private spreadsheetService: SpreadsheetService,
    private configService: ConfigService,
    private papa: Papa,
    private speechService: SpeechService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private toastr: ToastrService) {}

  tableData: string[][] = [];

  ngOnInit(): void {
    this.numberOfLanguages = Number(this.configService.getConfigValue('numberOfLanguages'));
    this.initForm();
    this.initButtons();
    this.disableAllPlaybackButtons();
    this.setGoogleSheetId();
    this.fetchData();
    
  }

  setGoogleSheetId() {
    let localStorageData = JSON.parse(localStorage.getItem('formData') || '{}');
    let savedData = JSON.parse(JSON.stringify(localStorageData));
    if(!savedData || isEmpty(savedData)) {
      this.route.queryParams.subscribe(params => {
        savedData = params;
        this.patchSavedSheetId(savedData);
      });
    }
    else {
      this.patchSavedSheetId(savedData);
    }
  }

  patchSavedSheetId(savedData: any) {
    if(savedData['sheetId']) {
      this.playbackForm.get('sheetId')?.patchValue(savedData['sheetId']);
    }
    else {
      this.playbackForm.get('sheetId')?.patchValue(this.configService.getConfigValue("googleSheetsId"));
    }
    this.spreadsheetService.setSheetId(this.playbackForm.get('sheetId')?.value);
  }

  initForm() {
    this.playbackForm = this.fb.group({
      sheetId: ['', Validators.required],
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

  initButtons() {
    this.playbackButtonsStatus = [
      {
        name: 'play',
        visible: true,
        disabled: false
      },
      {
        name: 'pause',
        visible: true,
        disabled: false
      },
      {
        name: 'resume',
        visible: true,
        disabled: false
      },
      {
        name: 'stop',
        visible: true,
        disabled: false
      },
      {
        name: 'forward',
        visible: true,
        disabled: false
      },
      {
        name: 'backward',
        visible: true,
        disabled: false
      },
    ];
  }

  getButtonVisibility(name: string) {
    return this.playbackButtonsStatus.find((btn) => btn.name == name)?.visible;
  }

  getButtonDisabledStatus(name: string) {
    return this.playbackButtonsStatus.find((btn) => btn.name == name)?.disabled;
  }

  setButtonVisibility(name: string, value: boolean) {
    let button = this.playbackButtonsStatus.find((btn) => btn.name == name);
    if(button) {
      button.visible = value;
    }
  }

  setButtonDisabledStatus(name: string, value: boolean) {
    let button = this.playbackButtonsStatus.find((btn) => btn.name == name);
    if(button) {
      button.disabled = value;
    }
  }

  disableAllPlaybackButtons() {
    this.playbackButtonsStatus.forEach((btn) => {
      this.setButtonDisabledStatus(btn.name, true);
    });
  }

  refreshPlaybackButtons() {
    if(this.isSpeaking) {
      this.setButtonVisibility('play', false);
      this.setButtonVisibility('resume', false);
      this.setButtonVisibility('pause', true);
      this.setButtonDisabledStatus('pause', false);
      this.setButtonVisibility('forward', true);
      this.setButtonDisabledStatus('forward', false);
      this.setButtonVisibility('backward', true);
      this.setButtonDisabledStatus('backward', false);
      this.setButtonVisibility('stop', true);
      this.setButtonDisabledStatus('stop', false);
    }
    else if(this.isStopped) {
      this.setButtonVisibility('play', true);
      this.setButtonDisabledStatus('play', false);
      this.setButtonVisibility('resume', false);
      this.setButtonVisibility('pause', false);
      this.setButtonVisibility('forward', true);
      this.setButtonDisabledStatus('forward', true);
      this.setButtonVisibility('backward', true);
      this.setButtonDisabledStatus('backward', true);
      this.setButtonVisibility('stop', false);
    }
    else if(!this.isSpeaking && !this.isStopped) {
      this.setButtonVisibility('play', false);
      this.setButtonVisibility('resume', true);
      this.setButtonDisabledStatus('resume', false);
      this.setButtonVisibility('pause', false);
      this.setButtonVisibility('forward', true);
      this.setButtonDisabledStatus('forward', false);
      this.setButtonVisibility('backward', true);
      this.setButtonDisabledStatus('backward', false);
      this.setButtonVisibility('stop', true);
      this.setButtonDisabledStatus('stop', false);
    }
  }

  patchForm() {
    if(this.tableData?.length) {
      this.playbackForm.get('startRow')?.setValue(1);
      this.playbackForm.get('endRow')?.setValue(this.tableData?.length - 1);
      this.refreshRowFieldsValidity();
    }
  }

  refreshRowFieldsValidity() {
    this.playbackForm.get('startRow')?.setValidators([
      Validators.min(this.getRangeVal('startRow').min),
      Validators.max(this.getRangeVal('startRow').max)
    ]);
    this.playbackForm.get('endRow')?.setValidators([
      Validators.min(this.getRangeVal('endRow').min),
      Validators.max(this.getRangeVal('endRow').max)
    ]);
    this.playbackForm.get('startRow')?.updateValueAndValidity();
    this.playbackForm.get('endRow')?.updateValueAndValidity();
  }

  getRangeVal(controlName: string): {min: number, max: number} {
    let min: number = 0;
    let max: number = 0;
    let reverse: boolean = this.playbackForm?.get('reversePlayback')?.value;
    let startRow = Number(this.playbackForm.get('startRow')?.value);
    let endRow = Number(this.playbackForm.get('endRow')?.value);
    if(controlName == 'startRow') {
      if(reverse) {
        min = endRow + 1;
        max = this.tableData?.length - 1;
      }
      else {
        min = 1;
        max = endRow - 1;
      }
    }
    else if(controlName == 'endRow') {
      if(reverse) {
        min = 1;
        max = startRow - 1;
      }
      else {
        min = startRow + 1;
        max = this.tableData?.length - 1;
      }
    }
    return {min: min, max: max};
  }

  initializeDropdowns() {
    let preferredLangs = this.configService.getConfigValue("preferredLangs");
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
        return preferredLangs?.length > i && preferredLangs[i].some((langItem: string) => langItem == x.value);
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

    const preferredVoice = this.configService.getConfigValue("preferredVoice");
    let foundPreferredVoice = this.populatedVoicesData[controlIndex-1].find(x => x.value.includes(preferredVoice));
    if(foundPreferredVoice) {
      this.playbackForm.get(`lang${controlIndex}Voice`)?.setValue(foundPreferredVoice.value);
    }
    else {
      this.playbackForm.get(`lang${controlIndex}Voice`)?.setValue(this.populatedVoicesData[controlIndex-1][0].value);
    }
  }

  getSpeechSynthesisVoice(controlName: string): SpeechSynthesisVoice | undefined {
    let voice: SpeechSynthesisVoice | undefined = this.allVoices.find((voiceItem: SpeechSynthesisVoice) => voiceItem.voiceURI == this.playbackForm.get(controlName)?.value);
    return voice;
  }

  async fetchDataAndParseAsync(): Promise<string[][]> {
    let EligibleRowSymbol = this.configService.getConfigValue("EligibleRowSymbol");
    return new Promise((resolve, reject) => {
      this.spreadsheetService.fetchSheetData().subscribe((csvData: string) => {
        this.papa.parse(csvData, {
          complete: (result) => {
            let filteredData = (result.data as any[]).filter((row: any, index: number) => {
              return index == 0 || row[this.numberOfLanguages] == EligibleRowSymbol;
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
    this.loading = true;
    this.playbackForm.disable();
    this.playbackForm.get('sheetId')?.enable();
    this.fetchDataAndParseAsync().then((data: string[][]) => {
      this.loading = false;
      this.playbackForm.enable();
      this.tableData = data;
      this.patchForm();
      this.refreshPlaybackButtons();
      this.loadSavedData();
    }, err => {
      this.loading = false;
      this.toastr.error("Please check the 'Sheet ID' and make sure that the sheet has the public access", "Unable fetch sheet", {
        timeOut: 5000
      });
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
    this.refreshRowFieldsValidity();
  }

  isHighlighted(rowIndex: number, colIndex: number): boolean {
    return this.highlightedRow === rowIndex && this.highlightedCol === colIndex;
  }

  rewindClick() {
    let reverse: boolean = this.playbackForm?.get('reversePlayback')?.value;
    let startRow = Number(this.playbackForm.get('startRow')?.value);
    if(reverse) {
      if(this.currentRow < startRow) {
        this.currentRow++;
      }
    }
    else {
      if(this.currentRow > startRow) {
        this.currentRow--;
      }
    }
    this.highlightWord(this.currentRow-1, this.currentColumn);
    this.refreshPlaybackButtons();
  }

  forwardClick() {
    let reverse: boolean = this.playbackForm?.get('reversePlayback')?.value;
    let endRow = Number(this.playbackForm.get('endRow')?.value);
    if(reverse) {
      if(this.currentRow > endRow) {
        this.currentRow--;
      }
    }
    else {
      if(this.currentRow < endRow) {
        this.currentRow++;
      }
    }
    this.highlightWord(this.currentRow-1, this.currentColumn);
    this.refreshPlaybackButtons();
  }

  resumeClick() {
    this.isSpeaking = true;
    this.speechService.resumeSpeech();
    this.refreshPlaybackButtons();
  }

  pauseClick() {
    this.isSpeaking = false;
    this.speechService.pauseSpeech();
    this.refreshPlaybackButtons();
  }

  playClick() {
    if(this.playbackForm?.invalid) {
      this.toastr.warning('Check the input fields', '', {
        timeOut: 2000
      });
      return;
    }
    this.isSpeaking = true;
    this.isStopped = false;
    this.refreshPlaybackButtons();
    this.playbackForm.get('startRow')?.disable();
    this.playbackForm.get('endRow')?.disable();
    this.playbackForm.get('sheetId')?.disable();
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
    this.isSpeaking = false;
    this.isStopped = true;
    this.refreshPlaybackButtons();
    this.playbackForm.get('startRow')?.enable();
    this.playbackForm.get('endRow')?.enable();
    this.playbackForm.get('sheetId')?.enable();
    this.highlightWord(-1, -1);
    this.speechService.stopSpeech();
  }

  saveClick() {
    if(this.playbackForm?.invalid) {
      this.toastr.warning('Check the input fields', 'Unable to save your changes', {
        timeOut: 2000
      });
      return;
    }
    else if(!this.tableData || this.tableData?.length == 0) {
      this.toastr.warning('No sheet is loaded', 'Unable to save your changes', {
        timeOut: 2000
      });
      return;
    }
    this.formQueryParams = this.playbackForm.getRawValue();
    this.router.navigate([], {
      queryParams: this.formQueryParams,
      queryParamsHandling: 'merge'
    });

    localStorage.setItem('formData', JSON.stringify(this.formQueryParams));

    this.toastr.success('Changes saved successfully', '', {
      timeOut: 2000
    });
  }

  loadSheetClick() {
    this.spreadsheetService.setSheetId(this.playbackForm.get('sheetId')?.value);
    this.fetchData();
  }

  loadSavedData() {
    let localStorageData = JSON.parse(localStorage.getItem('formData') || '{}');
    let savedData = JSON.parse(JSON.stringify(localStorageData));
    if(!savedData || isEmpty(savedData)) {
      this.route.queryParams.subscribe(params => {
        savedData = params;
        this.patchSavedData(savedData);
      });
    }
    else {
      this.patchSavedData(savedData);
    }
  }

  patchSavedData(savedData: any) {
    if(savedData['startRow'] && 
      Number(savedData['startRow']) <= this.getRangeVal('startRow').max && 
      Number(savedData['startRow']) >= this.getRangeVal('startRow').min)
    {
      this.playbackForm.get('startRow')?.patchValue(Number(savedData['startRow']));
    }
    if(savedData['endRow'] && 
      Number(savedData['endRow']) <= this.getRangeVal('endRow').max && 
      Number(savedData['endRow']) >= this.getRangeVal('endRow').min)
    {
      this.playbackForm.get('endRow')?.patchValue(Number(savedData['endRow']));
    }
    if(savedData['vocalSpeed'] && Number(savedData['vocalSpeed']) >= this.vocalSpeedRange.min && Number(savedData['vocalSpeed']) <= this.vocalSpeedRange.max)
    {
      this.playbackForm.get('vocalSpeed')?.patchValue(Number(savedData['vocalSpeed']));
    }
    if(savedData['inbetweenDelay'] && Number(savedData['inbetweenDelay']) >= this.inbetweenDelayRange.min && Number(savedData['inbetweenDelay']) <= this.inbetweenDelayRange.max)
    {
      this.playbackForm.get('inbetweenDelay')?.patchValue(Number(savedData['inbetweenDelay']));
    }
    this.playbackForm.get('reversePlayback')?.patchValue(savedData['reversePlayback'] == 'true');
    this.playbackForm.get('repeat')?.patchValue(savedData['repeat'] == 'true');
    this.playbackForm.get('reverseSpeechOrder')?.patchValue(savedData['reverseSpeechOrder'] == 'true');
    
    for(let i = 0; i < this.numberOfLanguages; i++) {
      if(savedData[`lang${i+1}`] && this.masterLanguages.some(x => x.value == savedData[`lang${i+1}`])) {
        this.playbackForm.get(`lang${i+1}`)?.setValue(savedData[`lang${i+1}`]);  
      }
      if(savedData[`lang${i+1}Voice`] && this.allVoices.some(x => x.name == savedData[`lang${i+1}Voice`])) {
        this.playbackForm.get(`lang${i+1}Voice`)?.setValue(savedData[`lang${i+1}Voice`]);
      }
    }
  }

  highlightWord(row: number, col: number) {
    this.highlightedRow = row;
    this.highlightedCol = col;

    const container = document.getElementById('table-container');
    const element = document.getElementById(`cell_${row}_${col}`);

    if (element && container) {
      const elementOffset = element.offsetTop;
      const scrollPosition = elementOffset - container.clientHeight / 2 + element.clientHeight / 2;

      container.scrollTo({
        top: scrollPosition,
        behavior: 'smooth',
      });
    }
  }

  async playAllTexts(): Promise<void> {
    if(this.isStopped) {
      this.highlightWord(-1, -1);
      this.playbackForm.get('startRow')?.enable();
      this.playbackForm.get('endRow')?.enable();
      this.playbackForm.get('sheetId')?.enable();
      return;
    }

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
        this.isSpeaking = false;
        this.isStopped = true;
        this.refreshPlaybackButtons();
        this.playbackForm.get('startRow')?.enable();
        this.playbackForm.get('endRow')?.enable();
        this.playbackForm.get('sheetId')?.enable();
        this.highlightWord(-1, -1);
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

  getLanguageName(label: string) {
    return ALLLANGUAGES.find((lang) => lang.value.some(x => x == label))?.label;
  }

}
