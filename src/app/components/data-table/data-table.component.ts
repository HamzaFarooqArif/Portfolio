import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { SpreadsheetService as SpreadsheetService } from '../../services/spreadsheet/spreadsheet.service';
import { Papa } from 'ngx-papaparse';
import { SpeechService } from '../../services/speech/speech.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ALLLANGUAGES } from '../../constants/constants';
import { ConfigService } from '../../services/config/config.service';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { isEmpty } from '../../Utilities/Utility';
import { debounceTime, Subject } from 'rxjs';


@Component({
  selector: 'app-data-table',
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss'
})

export class DataTableComponent implements OnInit, OnDestroy {
  componentInitialized: boolean = false;
  private wakeLock: WakeLockSentinel | null = null;
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
  playedIndices: number[] = [];
  jumpInterval: number = 200;
  private skipSubject = new Subject<void>();

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
    this.onInitAsync();

    this.skipSubject.pipe(
      debounceTime(this.jumpInterval)
    ).subscribe(() => {
      this.isSpeaking = true;
      this.speechService.resumeSpeech();
      this.refreshPlaybackButtons();
      this.speakNow();
    });
  }

  async onInitAsync() {
    try {
      this.initForm();
      await this.getLanguages();
      this.addLanguageControls();
      this.initButtons();
      this.disableAllPlaybackButtons();
      await this.setGoogleSheetId();
      await this.fetchData();
      this.patchForm();
      this.refreshPlaybackButtons();
      this.loadSavedData();
      this.keepScreenOn();
    } catch (error) {
      console.error('An error occurred during initialization:', error);
    } finally {
      this.componentInitialized = true;
    }
  }

  addLanguageControls() {
    for (let i = 0; i < this.numberOfLanguages; i++) {
      this.playbackForm.addControl(`lang${i+1}`, this.fb.control('', Validators.required));
      this.playbackForm.addControl(`lang${i+1}Voice`, this.fb.control('', Validators.required));
    }
  }

  async setGoogleSheetId(): Promise<void> {
    return new Promise((resolve, reject) => {
      let localStorageData = JSON.parse(localStorage.getItem('formData') || '{}');
      let savedData = JSON.parse(JSON.stringify(localStorageData));
      if(!savedData || isEmpty(savedData)) {
        this.route.queryParams.subscribe(params => {
          savedData = params;
          this.patchSavedSheetId(savedData);
          resolve();
        }, err => {
          reject(err);
        });
      }
      else {
        this.patchSavedSheetId(savedData);
        resolve();
      }
    });
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

  async getLanguages(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.speechService.getLangsAsync()
      .then((voices: SpeechSynthesisVoice[]) => {
        this.allVoices = voices;
        this.initializeMasterLanguages();
        resolve();
      })
      .catch((error: any) => {
        // console.error(error);
        this.speechService.init().then(() => {
          this.speechService.getLangsAsync().then((voices: SpeechSynthesisVoice[]) => {
            this.allVoices = voices;
            this.initializeMasterLanguages();
            resolve();
          }).catch(reject);
        }).catch(reject);
      });
    });
  }

  initForm() {
    this.playbackForm = this.fb.group({
      sheetId: ['', Validators.required],
      startRow: ['', Validators.required],
      endRow: ['', Validators.required],
      vocalSpeed: [1],
      inbetweenDelayColumn: [0],
      inbetweenDelayRow: [0],
      repeat: [false],
      shuffle: [false],
      reversePlayback: [false],
      reverseSpeechOrder: [false],
    });
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
      {
        name: 'reverse',
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
    this.refreshButtonsWithshuffle();
    if(this.isSpeaking) {
      this.setButtonVisibility('play', false);
      this.setButtonVisibility('resume', false);
      this.setButtonVisibility('pause', true);
      this.setButtonDisabledStatus('pause', false);
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

  initializeMasterLanguages() {
    Array.from(new Set(this.allVoices.map(item => item.lang))).forEach((item: string) => {
      this.masterLanguages.push(
        {
          value: item,
          label: item
        }
      );
    });
  }

  initializeDropdowns() {
    let preferredLangs = this.configService.getConfigValue("preferredLangs");

    for(let i = 0; i < this.numberOfLanguages; i++) {
      if(this.playbackForm.get(`lang${i+1}`)?.value?.length == 0) {
        let preferredLang = this.masterLanguages.find(x => {
          return preferredLangs?.length > i && preferredLangs[i].some((langItem: string) => langItem == x.value);
        })?.value ?? this.masterLanguages[0].value;
        this.playbackForm.get(`lang${i+1}`)?.setValue(preferredLang);
      }
      this.refreshVoiceDropdown(i+1);
    }
  }

  refreshVoiceDropdown(controlIndex: number, changeFromForm?: boolean) {
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

    if(this.playbackForm.get(`lang${controlIndex}Voice`)?.value?.length == 0) {
      const preferredVoice = this.configService.getConfigValue("preferredVoice");
      let foundPreferredVoice = this.populatedVoicesData[controlIndex-1].find(x => x.value.includes(preferredVoice));
      if(foundPreferredVoice) {
        this.playbackForm.get(`lang${controlIndex}Voice`)?.setValue(foundPreferredVoice.value);
      }
      else {
        this.playbackForm.get(`lang${controlIndex}Voice`)?.setValue(this.populatedVoicesData[controlIndex-1][0].value);
      }
    } else if(changeFromForm) {
      this.playbackForm.get(`lang${controlIndex}Voice`)?.setValue(this.populatedVoicesData[controlIndex-1][0].value);
    }

  }

  getSpeechSynthesisVoice(controlName: string): SpeechSynthesisVoice | undefined {
    let voice: SpeechSynthesisVoice | undefined = this.allVoices.find((voiceItem: SpeechSynthesisVoice) => voiceItem.voiceURI == this.playbackForm.get(controlName)?.value);
    return voice;
  }

  async fetchDataAndParseAsync(): Promise<string[][]> {
    this.loading = true;
    let EligibleRowSymbol = this.configService.getConfigValue("EligibleRowSymbol");
    return new Promise((resolve, reject) => {
      this.spreadsheetService.fetchSheetData().subscribe((csvData: string) => {
        this.papa.parse(csvData, {
          complete: (result) => {
            this.loading = false;
            let filteredData = (result.data as any[]).filter((row: any, index: number) => {
              return index == 0 || row[this.numberOfLanguages] == EligibleRowSymbol;
            });
            let parsedRows = filteredData.map((row: any) => (
              row.slice(0, this.numberOfLanguages)
              )).filter((row: string[]) => {
              return row.some(x => x != "");
            });
  
            resolve(parsedRows);
          }
        });
      }, err => {
        this.loading = false;
        reject(err);
      });
    });
  }

  async fetchData(): Promise<void> {
    this.loading = true;
    return new Promise((resolve, reject) => {
      this.playbackForm.disable();
      this.playbackForm.get('sheetId')?.enable();
      this.fetchDataAndParseAsync().then((data: string[][]) => {
        this.loading = false;
        this.playbackForm.enable();
        this.tableData = data;
        resolve();
      }, err => {
        this.loading = false;
        this.toastr.error("Please check the 'Sheet ID' and make sure that the sheet has the public access", "Unable fetch sheet", {
          timeOut: 5000
        });
        reject(err);
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
    let reverseSpeechOrder: boolean = this.playbackForm?.get('reverseSpeechOrder')?.value;
    let startRow = Number(this.playbackForm.get('startRow')?.value);

    if(reverse) {
      if(reverseSpeechOrder) {
        if(this.currentColumn < this.tableData[0]?.length - 1) {
          this.currentColumn = this.tableData[0]?.length - 1;
        } else if(this.currentRow < startRow){
          this.currentRow++;
        }
      } else {
        if(this.currentColumn > 0) {
          this.currentColumn = 0;
        } else if(this.currentRow < startRow){
          this.currentRow++;
        }
      }
    } else {
      if(reverseSpeechOrder) {
        if(this.currentColumn < this.tableData[0]?.length - 1) {
          this.currentColumn = this.tableData[0]?.length - 1;
        } else if(this.currentRow > startRow){
          this.currentRow--;
        }
      } else {
        if(this.currentColumn > 0) {
          this.currentColumn = 0;
        } else if(this.currentRow > startRow){
          this.currentRow--;
        }
      }
    }
    
    this.highlightWord(this.currentRow-1, this.currentColumn);
    this.refreshPlaybackButtons();

    this.isSpeaking = false;
    this.speechService.stopSpeech();
    this.speechService.pauseSpeech();
    this.skipSubject.next();
  }

  forwardClick() {
    let reverse: boolean = this.playbackForm?.get('reversePlayback')?.value;
    let reverseSpeechOrder: boolean = this.playbackForm?.get('reverseSpeechOrder')?.value;
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
    if(reverseSpeechOrder) {
      this.currentColumn = this.tableData[0]?.length - 1;
    }
    else {
      this.currentColumn = 0;
    }
    
    this.highlightWord(this.currentRow-1, this.currentColumn);
    this.refreshPlaybackButtons();

    this.isSpeaking = false;
    this.speechService.stopSpeech();
    this.speechService.pauseSpeech();
    this.skipSubject.next();
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
    this.playedIndices = [];
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

  deleteClick() {
    localStorage.clear();
    this.router.navigate([], {
      queryParams: {},
    });
    this.toastr.success("Saved Changes Cleaned Successfully", "", {
      timeOut: 3000
    });
  }

  async loadSheetClick() {
    if(this.playbackForm.get('sheetId')?.valid) {
      let input = this.playbackForm.get('sheetId')?.value;
      const isSheetId = /^[a-zA-Z0-9-_]+$/.test(input); // Validate plain sheetId format
      if (isSheetId) {
        this.playbackForm.get('sheetId')?.setValue(input);
      }
      else {
        const match = input.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if(match) {
          this.playbackForm.get('sheetId')?.setValue(match[1]);
        }
      }
      this.spreadsheetService.setSheetId(this.playbackForm.get('sheetId')?.value);
      await this.fetchData();
      this.patchForm();
      this.refreshPlaybackButtons();
      this.loadSavedData();
    }
  }

  async loadSavedData(): Promise<void> {
    return new Promise((resolve, reject) => {
      let localStorageData = JSON.parse(localStorage.getItem('formData') || '{}');
      let savedData = JSON.parse(JSON.stringify(localStorageData));
      if(!savedData || isEmpty(savedData)) {
        this.route.queryParams.subscribe(params => {
          savedData = params;
          this.patchSavedData(savedData);
          this.initializeDropdowns();
          resolve();
        }, err => {
          reject(err);
        });
      }
      else {
        this.patchSavedData(savedData);
        this.initializeDropdowns();
        resolve();
      }
    });
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
    if(savedData['inbetweenDelayColumn'] && Number(savedData['inbetweenDelayColumn']) >= this.inbetweenDelayRange.min && Number(savedData['inbetweenDelayColumn']) <= this.inbetweenDelayRange.max)
    {
      this.playbackForm.get('inbetweenDelayColumn')?.patchValue(Number(savedData['inbetweenDelayColumn']));
    }
    if(savedData['inbetweenDelayRow'] && Number(savedData['inbetweenDelayRow']) >= this.inbetweenDelayRange.min && Number(savedData['inbetweenDelayRow']) <= this.inbetweenDelayRange.max)
    {
      this.playbackForm.get('inbetweenDelayRow')?.patchValue(Number(savedData['inbetweenDelayRow']));
    }
    this.playbackForm.get('reversePlayback')?.patchValue(this.checkForTruthy(savedData['reversePlayback']));
    this.playbackForm.get('repeat')?.patchValue(this.checkForTruthy(savedData['repeat']));
    this.playbackForm.get('shuffle')?.patchValue(this.checkForTruthy(savedData['shuffle']));
    this.playbackForm.get('reverseSpeechOrder')?.patchValue(this.checkForTruthy(savedData['reverseSpeechOrder']));
    
    for(let i = 0; i < this.numberOfLanguages; i++) {
      if(savedData[`lang${i+1}`] && this.masterLanguages.some(x => x.value == savedData[`lang${i+1}`])) {
        this.playbackForm.get(`lang${i+1}`)?.setValue(savedData[`lang${i+1}`]);  
      }
      if(savedData[`lang${i+1}Voice`] && this.allVoices.some(x => x.name == savedData[`lang${i+1}Voice`])) {
        this.playbackForm.get(`lang${i+1}Voice`)?.setValue(savedData[`lang${i+1}Voice`]);
      }
    }
  }

  checkForTruthy(val: any) {
    let result = (typeof(val) == 'boolean' && Boolean(val)) || (typeof(val) == 'string' && val == 'true');
    return result;
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

  async speakNow() {
    let text = this.tableData[this.currentRow][this.currentColumn];
    let voice: SpeechSynthesisVoice | undefined = this.getSpeechSynthesisVoice(`lang${this.currentColumn + 1}Voice`);
    let vocalSpeed = Number(this.playbackForm?.get('vocalSpeed')?.value);
    if(text && voice) {
      this.addToPlayed(this.currentRow);
      await this.speechService.speakAsync(text, voice, vocalSpeed);
    }
  }

  async playAllTexts(): Promise<void> {
    if(this.isStopped) {
      this.highlightWord(-1, -1);
      this.playbackForm.get('startRow')?.enable();
      this.playbackForm.get('endRow')?.enable();
      this.playbackForm.get('sheetId')?.enable();
      this.playedIndices = [];
      return;
    }

    if(this.speechTerminationCriteria()) {
      this.highlightWord(this.currentRow-1, this.currentColumn);
      let reverseSpeechOrder: boolean = this.playbackForm?.get('reverseSpeechOrder')?.value;
      await this.speakNow();
      if(reverseSpeechOrder) {
        if(this.currentColumn > 0) {
          let delay = Number(this.playbackForm.get('inbetweenDelayColumn')?.value);
          let timeout = setTimeout(() => {
            clearTimeout(timeout);
            this.setNextCell();
            return this.playAllTexts();
          }, delay*1000);
        }
        else {
          let delay = Number(this.playbackForm.get('inbetweenDelayRow')?.value);
          let timeout = setTimeout(() => {
            clearTimeout(timeout);
            this.setNextCell();
            return this.playAllTexts();
          }, delay*1000);
        }
      }
      else {
        if(this.currentColumn < this.tableData[0]?.length - 1) {
          let delay = Number(this.playbackForm.get('inbetweenDelayColumn')?.value);
          let timeout = setTimeout(() => {
            clearTimeout(timeout);
            this.setNextCell();
            return this.playAllTexts();
          }, delay*1000);
        }
        else {
          let delay = Number(this.playbackForm.get('inbetweenDelayRow')?.value);
          let timeout = setTimeout(() => {
            clearTimeout(timeout);
            this.setNextCell();
            return this.playAllTexts();
          }, delay*1000);
        }
      }
    }
    else {
      let repeat = this.playbackForm?.get('repeat')?.value;
      if(repeat) {
        this.playedIndices = [];
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
        this.playedIndices = [];
        return;
      }
    }
  }

  setNextCell() {
    let reverse: boolean = this.playbackForm?.get('reversePlayback')?.value;
    let shuffle: boolean = this.playbackForm?.get('shuffle')?.value;
    let reverseSpeechOrder: boolean = this.playbackForm?.get('reverseSpeechOrder')?.value;

    if(reverse) {
      if(reverseSpeechOrder) {
        if(this.currentColumn == 0) {
          this.currentColumn = this.tableData[0]?.length - 1;
          if(shuffle) {
            this.currentRow = this.getRandomRow();
          } else {
            this.currentRow -= 1;
          }
        }
        else {
          this.currentColumn -= 1;
        }
      }
      else {
        if(this.currentColumn == this.tableData[0]?.length - 1) {
          this.currentColumn = 0;
          if(shuffle) {
            this.currentRow = this.getRandomRow();
          } else {
            this.currentRow -= 1;
          }  
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
          if(shuffle) {
            this.currentRow = this.getRandomRow();
          } else {
            this.currentRow += 1;
          }  
        }
        else {
          this.currentColumn -= 1;
        }
      }
      else {
        if(this.currentColumn == this.tableData[0]?.length - 1) {
          this.currentColumn = 0;
          if(shuffle) {
            this.currentRow = this.getRandomRow();
          } else {
            this.currentRow += 1;
          }  
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
      return this.currentRow > -1 && this.currentRow < this.tableData?.length && (startRowInputVal < endRowInputVal && this.currentRow <= endRowInputVal);
    }
  }

  getLanguageName(label: string) {
    return ALLLANGUAGES.find((lang) => lang.value.some(x => x == label))?.label;
  }

  keepScreenOn(){
    let interval = setInterval(() => {
      if(!this.wakeLock || this.wakeLock?.released == true) {
        console.log('Retrying Wake Lock...');
        this.applyScreenOn();
      }
    }, 1000);
  }

  async applyScreenOn(): Promise<void> {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        console.log('Screen Wake Lock activated');
      } else {
        console.error('Screen Wake Lock API is not supported on this device.');
      }
    } catch (err: any) {
      // console.error(`Failed to activate screen wake lock: ${err?.message}`);
    }
  }

  async releaseScreenOn(): Promise<void> {
    if (this.wakeLock) {
      await this.wakeLock.release();
      this.wakeLock = null;
      console.log('Screen Wake Lock released');
    }
  }

  addToPlayed(val: number) {
    if(!this.playedIndices.includes(val)) {
      this.playedIndices.push(val);
    }
  }

  getRandomRow(): number {
    let min = this.playbackForm.get('startRow')?.value;
    let max = this.playbackForm.get('endRow')?.value;
    if(max < min) {
      let temp = max;
      max = min;
      min = temp;
    }

    const possibleNumbers = [];
    for (let i = min; i <= max; i++) {
      if (!this.playedIndices.includes(i)) {
        possibleNumbers.push(i);
      }
    }
  
    if (possibleNumbers.length === 0) {
      return -1;
    }
  
    const randomIndex = Math.floor(Math.random() * possibleNumbers.length);
    return possibleNumbers[randomIndex];
  }

  refreshButtonsWithshuffle() {
    if(this.playbackForm.get('shuffle')?.value)
    {
      this.setButtonDisabledStatus('forward', true);
      this.setButtonDisabledStatus('backward', true);
      this.setButtonDisabledStatus('reverse', true);
    }
    else {
      this.setButtonDisabledStatus('forward', false);
      this.setButtonDisabledStatus('backward', false);
      this.setButtonDisabledStatus('reverse', false);
    }
  }

  shuffleCheckboxChanged() {
    let timeout = setTimeout(() => {
      clearTimeout(timeout);
      this.refreshPlaybackButtons();
    }, 1);
  }

  resetRangeSlider(controlName: string) {
    if(controlName == "inbetweenDelayRow") {
      this.playbackForm.get(controlName)?.setValue(0);
    }
    else if(controlName == "inbetweenDelayColumn") {
      this.playbackForm.get(controlName)?.setValue(0);
    }
    else if(controlName == "vocalSpeed") {
      this.playbackForm.get(controlName)?.setValue(1);
    }
  }

  async resetToDefaults() {
    this.playbackForm.get('sheetId')?.patchValue(this.configService.getConfigValue("googleSheetsId"));
    this.spreadsheetService.setSheetId(this.playbackForm.get('sheetId')?.value);
    this.playbackForm.disable();
    this.playbackForm.get('sheetId')?.enable();
    let data = await this.fetchDataAndParseAsync().catch(err => {
      this.loading = false;
      this.toastr.error("Please check the 'Sheet ID' and make sure that the sheet has the public access", "Unable fetch sheet", {
        timeOut: 5000
      });
    });
    this.playbackForm.enable();
    this.tableData = data ?? [];
    this.playbackForm.get('repeat')?.setValue(false);
    this.playbackForm.get('shuffle')?.setValue(false);
    this.playbackForm.get('reversePlayback')?.setValue(false);
    this.playbackForm.get('reverseSpeechOrder')?.setValue(false);
    if(this.tableData?.length) {
      this.playbackForm.get('startRow')?.setValue(1);
      this.playbackForm.get('endRow')?.setValue(this.tableData?.length - 1);
      this.refreshRowFieldsValidity();
    }
    this.resetRangeSlider("inbetweenDelayRow");
    this.resetRangeSlider("inbetweenDelayColumn");
    this.resetRangeSlider("vocalSpeed");
    for(let i = 0; i < this.numberOfLanguages; i++) {
      this.playbackForm.get(`lang${i+1}`)?.setValue("");
      this.playbackForm.get(`lang${i+1}Voice`)?.setValue("");
    }
    this.initializeDropdowns();
    this.refreshPlaybackButtons();
  }

  ngOnDestroy(): void {
      this.releaseScreenOn();
  }

}
