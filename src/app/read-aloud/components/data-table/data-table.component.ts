import { Component, HostListener, OnDestroy, OnInit, Renderer2, signal } from '@angular/core';
import { SpreadsheetService as SpreadsheetService } from '../../services/spreadsheet/spreadsheet.service';
import { Papa } from 'ngx-papaparse';
import { SpeechService } from '../../services/speech/speech.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ALLLANGUAGES } from '../../constants/constants';
import { ConfigService } from '../../services/config/config.service';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { debounceTime, Subject } from 'rxjs';
import { MediaControlService } from '../../services/media-control/media-control.service';
import { LoadingUtil } from '../../../utilities/loading/LoadingUtil';
import { Utils } from '../../utils/Utils';


@Component({
  selector: 'app-data-table',
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss'
})

export class DataTableComponent implements OnInit, OnDestroy {
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
     // Ignore keypress if a form control is focused
     const target = event.target as HTMLElement;
     if (event.key != 'MediaPlayPause' && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) {
       return;
     }

    if (event.key === 'ArrowLeft') {
      if(!this.getButtonDisabledStatus('backward')) {
        this.rewind();
      }
    } else if (event.key === 'ArrowRight') {
      if(!this.getButtonDisabledStatus('forward')) {
        this.forward();
      }
    }
    else if (event.key === ' ' || event.key === 'Spacebar') {
      if(this.getButtonVisibility('play')) {
        this.play();
      } else if(this.getButtonVisibility('resume')) {
        this.resume();
      } else if(this.getButtonVisibility('pause')) {
        this.pause();
      }
    }
    else if (event.key === 'MediaPlayPause') {
      if(!this.mediaControlService.userActionInitiated) {
        if(this.getButtonVisibility('play')) {
          this.play();
        } else if(this.getButtonVisibility('resume')) {
          this.resume();
        } else if(this.getButtonVisibility('pause')) {
          this.pause();
        }
      }
    }
  }
  
  playAllTextsStackCount: number = 0;
  componentInitialized: boolean = false;
  private wakeLock: WakeLockSentinel | null = null;
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
  inbetweenDelayRange: {min: number, max: number} = {min: 0, max: 10};
  wordPausesRange: {min: number, max: number} = {min: 0, max: 2};
  playedIndices: number[] = [];
  jumpInterval: number = 200;
  private skipSubject = new Subject<void>();
  killPlayAllText: boolean = false;

  get isPaused() {
    return !this.isStopped && !this.isSpeaking;
  }

  get loading() {
    return LoadingUtil.isLoading();
  }

  constructor(
    private spreadsheetService: SpreadsheetService,
    private configService: ConfigService,
    private mediaControlService: MediaControlService,
    private papa: Papa,
    private speechService: SpeechService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private renderer: Renderer2,
    private toastr: ToastrService) {}

  tableData: string[][] = [];

  symbolFound(symbolStr: string, row: any) {
    let result = false;
    if(row?.length <= this.numberOfLanguages) return result;

    let symbolVal = this.configService.getConfigValue(symbolStr);
    let symbols = row[this.numberOfLanguages].split(" ").map((item: any) => item.trim().toLowerCase());
    if(symbols && symbols?.length) {
      result = symbols.some((x: any) => x == symbolVal);
    }
    return result;
  }

  ngOnInit(): void {
    this.setNumberOfLanguages();
    this.onInitAsync();

    this.skipSubject.pipe(
      debounceTime(this.jumpInterval)
    ).subscribe(() => {
      this.isSpeaking = true;
      // this.speechService.resumeSpeech();
      this.refreshPlaybackButtons();
      this.killPlayAllText = false;
      this.playAllTexts(0, false);
    });

    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }

  setNumberOfLanguages() {
    let localStorageData = JSON.parse(localStorage.getItem('formData') || '{}');
    let savedData = JSON.parse(JSON.stringify(localStorageData));
    if(savedData['languageColumns']) {
      this.numberOfLanguages = Number(savedData['languageColumns']);
    }
    else {
      this.numberOfLanguages = Number(this.configService.getConfigValue('numberOfLanguages'));
    }
  }

  visibilityChangeHandler = () => {
    let isTabVisible = document.visibilityState === 'visible';
    if(!isTabVisible) {
      if(this.getButtonVisibility('pause')) {
        this.pause();
        this.mediaControlService.pause();
      }
    }
  };

  setupMediaControls() {
    this.mediaControlService.forwardCallback = () => {
      return new Promise((resolve, reject) => {
        if(document.visibilityState != 'visible') {
          reject();
          return;
        };
        if(!this.getButtonDisabledStatus('forward')) {
          this.forwardClick();
          resolve();
        } else {
          reject();
        }
      });
    };

    this.mediaControlService.backwardCallback = () => {
      return new Promise((resolve, reject) => {
        if(document.visibilityState != 'visible') {
          reject();
          return;
        };
        if(!this.getButtonDisabledStatus('backward')) {
          this.rewindClick();
          resolve();
        } else {
          reject();
        }
      });
    };

    this.mediaControlService.pauseCallback = () => {
      return new Promise((resolve, reject) => {
        if(document.visibilityState != 'visible') {
          reject();
          return;
        };
        if(this.getButtonVisibility('play')) {
          this.play();
          reject();
        } else if(this.getButtonVisibility('resume')) {
          this.resume();
          reject();
        } else if(this.getButtonVisibility('pause')) {
          this.pause();
          resolve();
        } else {
          reject();
        }
      });
    };

    this.mediaControlService.playCallback = () => {
      return new Promise((resolve, reject) => {
        if(document.visibilityState != 'visible') {
          reject();
          return;
        };
        if(this.getButtonVisibility('play')) {
          this.play();
          resolve();
        } else if(this.getButtonVisibility('resume')) {
          this.resume();
          resolve();
        } else if(this.getButtonVisibility('pause')) {
          this.pause();
          reject();
        } else {
          reject();
        }
      });
    };

    this.mediaControlService.stopCallback = () => {
      return new Promise((resolve, reject) => {
        if(document.visibilityState != 'visible') {
          reject();
          return;
        };
        if(this.getButtonVisibility('stop')) {
          this.stop();
          resolve();
        } else {
          reject();
        }
      });
    };
    
    this.mediaControlService.playDummyAudio();
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
      this.assignTheme();
      this.keepScreenOn();
    } catch (error) {
      console.error('An error occurred during initialization:', error);
    } finally {
      this.componentInitialized = true;
    }
  }

  addLanguageControls() {
    for (let i = 0; i < this.numberOfLanguages; i++) {
      this.addLanguageControl(i);
    }
  }

  addLanguageControl(index: number) {
    this.playbackForm.addControl(`lang${index+1}`, this.fb.control('', Validators.required));
    this.playbackForm.addControl(`lang${index+1}Voice`, this.fb.control('', Validators.required));
  }

  removeLanguageControl(index: number) {
    this.playbackForm.removeControl(`lang${index+1}`);
    this.playbackForm.removeControl(`lang${index+1}Voice`);
  }

  async setGoogleSheetId(): Promise<void> {
    return new Promise((resolve, reject) => {
      let localStorageData = JSON.parse(localStorage.getItem('formData') || '{}');
      let savedData = JSON.parse(JSON.stringify(localStorageData));
      if(!savedData || Utils.isEmpty(savedData)) {
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

    if(savedData['subSheetId']) {
      this.playbackForm.get('subSheetId')?.patchValue(savedData['subSheetId']);
    }
    this.spreadsheetService.setSheetId(this.playbackForm.get('sheetId')?.value);
    this.spreadsheetService.setSubSheetId(this.playbackForm.get('subSheetId')?.value);
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
      subSheetId: [''],
      startRow: ['', Validators.required],
      endRow: ['', Validators.required],
      speakOnlyColumnVal: [1],
      speakOnlyColumnCheck: [false],
      vocalSpeed: [1],
      inbetweenDelayColumn: [0],
      inbetweenDelayRow: [0],
      wordPauses: [0],
      repeat: [false],
      shuffle: [false],
      reversePlayback: [false],
      reverseSpeechOrder: [false],
      lightMode: [false],
      languageColumns: ['', Validators.required],
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
      this.setButtonVisibility('forward', true);
      this.setButtonDisabledStatus('forward', false);
      this.setButtonVisibility('backward', true);
      this.setButtonDisabledStatus('backward', false);
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
    else if(this.isPaused) {
      this.setButtonVisibility('play', false);
      this.setButtonVisibility('resume', true);
      this.setButtonDisabledStatus('resume', false);
      this.setButtonVisibility('pause', false);
      this.setButtonVisibility('stop', true);
      this.setButtonDisabledStatus('stop', false);
      this.setButtonVisibility('forward', true);
      this.setButtonDisabledStatus('forward', false);
      this.setButtonVisibility('backward', true);
      this.setButtonDisabledStatus('backward', false);
    }
  }

  patchForm() {
    if(this.tableData?.length) {
      this.playbackForm.get('startRow')?.setValue(1);
      this.playbackForm.get('endRow')?.setValue(this.tableData?.length - 1);
      this.playbackForm?.get('languageColumns')?.setValue(this.numberOfLanguages);
      this.refreshRowFieldsValidity();
    }
  }

  tryChangeNumberOfLanguages(value: number) {
      let languageColumnsMin = Number(this.configService.getConfigValue("numberOfLanguages"));
      let languageColumnsMax = Number(this.configService.getConfigValue("numberOfLanguagesMax"));
      let newValue = Number(this.playbackForm.get('languageColumns')?.value) + value;
      if(newValue >= languageColumnsMin && newValue <= languageColumnsMax) {
        this.playbackForm.get('languageColumns')?.setValue(newValue);
        this.numberOfLanguages = newValue;
        if(value == 1) {
          this.addLanguageControl(newValue-1);
          this.playbackForm.get(`lang${newValue}`)?.setValue(this.masterLanguages[0].value);
          this.refreshVoiceDropdown(newValue);
        }
        if(value == -1) {
          this.removeLanguageControl(newValue-1);
          this.playbackForm.get(`lang${newValue}`)?.setValue(this.masterLanguages[0].value);
        }
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
    if(this.playbackForm.get('speakOnlyColumnCheck')?.value) {
      this.playbackForm.get('speakOnlyColumnVal')?.setValidators([
        Validators.required,
        Validators.min(1),
        Validators.max(this.tableData[0]?.length - 1)
      ]);
    } else {
      this.playbackForm.get('speakOnlyColumnVal')?.setValidators(null);
    }
    let languageColumnsMin = Number(this.configService.getConfigValue("numberOfLanguages"));
    let languageColumnsMax = Number(this.configService.getConfigValue("numberOfLanguagesMax"));
    this.playbackForm.get('languageColumns')?.setValidators([
      Validators.min(languageColumnsMin),
      Validators.max(languageColumnsMax)
    ]);
    this.playbackForm.get('startRow')?.updateValueAndValidity();
    this.playbackForm.get('endRow')?.updateValueAndValidity();
    this.playbackForm.get('speakOnlyColumnVal')?.updateValueAndValidity();
    this.playbackForm.get('languageColumns')?.updateValueAndValidity();

    if(this.playbackForm.get('languageColumns')?.valid) {
      this.numberOfLanguages = Number(this.playbackForm.get('languageColumns')?.value);
    }
  }

  increaseSlider(controlName: string) {
    if(controlName == "vocalSpeed" && this.playbackForm.get("vocalSpeed")?.value < this.vocalSpeedRange.max) {
      this.playbackForm.get("vocalSpeed")?.setValue(Math.min(this.vocalSpeedRange.max, this.playbackForm.get("vocalSpeed")?.value + 0.1));
    }
    else if(controlName == "inbetweenDelayColumn" && this.playbackForm.get("inbetweenDelayColumn")?.value < this.inbetweenDelayRange.max) {
      if (this.isInteger(this.playbackForm.get("inbetweenDelayColumn")?.value)) {
        this.playbackForm.get("inbetweenDelayColumn")?.setValue(this.playbackForm.get("inbetweenDelayColumn")?.value + 1);
      } else {
        this.playbackForm.get("inbetweenDelayColumn")?.setValue(Math.ceil(this.playbackForm.get("inbetweenDelayColumn")?.value));
      }
    }
    else if(controlName == "inbetweenDelayRow" && this.playbackForm.get("inbetweenDelayRow")?.value < this.inbetweenDelayRange.max) {
      if (this.isInteger(this.playbackForm.get("inbetweenDelayRow")?.value)) {
        this.playbackForm.get("inbetweenDelayRow")?.setValue(this.playbackForm.get("inbetweenDelayRow")?.value + 1);
      } else {
        this.playbackForm.get("inbetweenDelayRow")?.setValue(Math.ceil(this.playbackForm.get("inbetweenDelayRow")?.value));
      }
    }
    else if(controlName == "wordPauses" && this.playbackForm.get("wordPauses")?.value < this.wordPausesRange.max) {
      this.playbackForm.get("wordPauses")?.setValue(Math.min(this.wordPausesRange.max, this.playbackForm.get("wordPauses")?.value + 0.1));
    }
  }

  decreaseSlider(controlName: string) {
    if(controlName == "vocalSpeed" && this.playbackForm.get("vocalSpeed")?.value > this.vocalSpeedRange.min) {
      this.playbackForm.get("vocalSpeed")?.setValue(Math.max(this.vocalSpeedRange.min, this.playbackForm.get("vocalSpeed")?.value - 0.1));
    }
    else if(controlName == "inbetweenDelayColumn" && this.playbackForm.get("inbetweenDelayColumn")?.value > this.inbetweenDelayRange.min) {
      if (this.isInteger(this.playbackForm.get("inbetweenDelayColumn")?.value)) {
        this.playbackForm.get("inbetweenDelayColumn")?.setValue(this.playbackForm.get("inbetweenDelayColumn")?.value - 1);
      } else {
        this.playbackForm.get("inbetweenDelayColumn")?.setValue(Math.floor(this.playbackForm.get("inbetweenDelayColumn")?.value));
      }
    }
    else if(controlName == "inbetweenDelayRow" && this.playbackForm.get("inbetweenDelayRow")?.value > this.inbetweenDelayRange.min) {
      if (this.isInteger(this.playbackForm.get("inbetweenDelayRow")?.value)) {
        this.playbackForm.get("inbetweenDelayRow")?.setValue(this.playbackForm.get("inbetweenDelayRow")?.value - 1);
      } else {
        this.playbackForm.get("inbetweenDelayRow")?.setValue(Math.floor(this.playbackForm.get("inbetweenDelayRow")?.value));
      }
    }
    else if(controlName == "wordPauses" && this.playbackForm.get("wordPauses")?.value > this.wordPausesRange.min) {
      this.playbackForm.get("wordPauses")?.setValue(Math.max(0, this.playbackForm.get("wordPauses")?.value - 0.1));
    }
  }

  private isInteger(value: number): boolean {
    return value % 1 === 0;
  }

  assignTheme() {
    if(this.playbackForm.get("lightMode")?.value) {
      this.renderer.removeClass(document.body, 'dark');
    } else {
      this.renderer.addClass(document.body, 'dark');
    }
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
    LoadingUtil.setStatus("app-data-table", true);
    return new Promise((resolve, reject) => {
      this.spreadsheetService.fetchSheetData().subscribe((csvData: string) => {
        this.papa.parse(csvData, {
          complete: (result) => {
            LoadingUtil.setStatus("app-data-table", false);
            let filteredData = (result.data as any[]).filter((row: any, index: number) => {
              let rowAllowedToRead = this.symbolFound("EligibleRowSymbol", row);
              return index == 0 || rowAllowedToRead;
            });
            let parsedRows = filteredData.map((row: any) => (
              row.slice(0, this.numberOfLanguages + 1)
              )).filter((row: string[]) => {
              return row.some(x => x != "");
            });
  
            resolve(parsedRows);
          }
        });
      }, err => {
        LoadingUtil.setStatus("app-data-table", false);
        reject(err);
      });
    });
  }

  async fetchData(): Promise<void> {
    LoadingUtil.setStatus("app-data-table", true);
    return new Promise((resolve, reject) => {
      this.playbackForm.disable();
      this.playbackForm.get('sheetId')?.enable();
      this.playbackForm.get('languageColumns')?.enable();
      this.fetchDataAndParseAsync().then((data: string[][]) => {
        LoadingUtil.setStatus("app-data-table", false);
        this.playbackForm.enable();
        this.tableData = data;
        resolve();
      }, err => {
        LoadingUtil.setStatus("app-data-table", false);
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

  rewind() {
    let reverse: boolean = this.playbackForm?.get('reversePlayback')?.value;
    let reverseSpeechOrder: boolean = this.playbackForm?.get('reverseSpeechOrder')?.value;
    let startRow = Number(this.playbackForm.get('startRow')?.value);
    let shuffle: boolean = this.playbackForm?.get('shuffle')?.value;

    if(reverse) {
      if(reverseSpeechOrder) {
        if(this.currentColumn < this.tableData[0]?.length - 2) {
          this.currentColumn = this.tableData[0]?.length - 2;
        } else if(this.currentRow < startRow){
          this.currentRow++;
        }
      } else {
        if(this.currentColumn > 0) {
          this.currentColumn = 0;
        } 
        // ===========================
        else if(shuffle) {
          let prevNum: number = -1;
          if(this.playedIndices?.length) {
            let foundIndex = this.playedIndices.findIndex(num => num == this.currentRow);
            if(foundIndex > 0) {
              prevNum = this.playedIndices[foundIndex - 1];
            }
          }
          if(prevNum > -1) {
            this.currentRow = prevNum;
          } else {
            return;
          }
        }
        // ===========================
        else if(this.currentRow < startRow){
          this.currentRow++;
        }
      }
    } else {
      if(reverseSpeechOrder) {
        if(this.currentColumn < this.tableData[0]?.length - 2) {
          this.currentColumn = this.tableData[0]?.length - 2;
        }
        // ===========================
        else if(shuffle) {
          let prevNum: number = -1;
          if(this.playedIndices?.length) {
            let foundIndex = this.playedIndices.findIndex(num => num == this.currentRow);
            if(foundIndex > 0) {
              prevNum = this.playedIndices[foundIndex - 1];
            }
          }
          if(prevNum > -1) {
            this.currentRow = prevNum;
          } else {
            return;
          }
        }
        // ===========================
        else if(this.currentRow > startRow){
          this.currentRow--;
        }
      } else {
        if(this.currentColumn > 0) {
          this.currentColumn = 0;
        }
        // ===========================
        else if(shuffle) {
          let prevNum: number = -1;
          if(this.playedIndices?.length) {
            let foundIndex = this.playedIndices.findIndex(num => num == this.currentRow);
            if(foundIndex > 0) {
              prevNum = this.playedIndices[foundIndex - 1];
            }
          }
          if(prevNum > -1) {
            this.currentRow = prevNum;
          } else {
            return;
          }
        }
        // ===========================
        else if(this.currentRow > startRow){
          this.currentRow--;
        }
      }
    }
    
    this.highlightWord(this.currentRow-1, this.currentColumn);
    this.refreshPlaybackButtons();

    this.isSpeaking = false;
    this.speechService.stopSpeech();
    // this.speechService.pauseSpeech();
    this.killPlayAllText = true;
    this.skipSubject.next();
  }

  forward() {
    let reverse: boolean = this.playbackForm?.get('reversePlayback')?.value;
    let reverseSpeechOrder: boolean = this.playbackForm?.get('reverseSpeechOrder')?.value;
    let endRow = Number(this.playbackForm.get('endRow')?.value);
    let shuffle: boolean = this.playbackForm?.get('shuffle')?.value;

    if(reverse) {
      // ===========================
      if(shuffle) {
        let randNum: number = -1;
        if(this.playedIndices?.length) {
          let foundIndex = this.playedIndices.findIndex(num => num == this.currentRow);
          if(foundIndex > -1 && foundIndex < this.playedIndices?.length - 1) {
            randNum = this.playedIndices[foundIndex + 1];
          }
          else {
            randNum = this.getRandomRow();
          }
        }
        if(randNum > -1) {
          this.currentRow = randNum;
        } else {
          return;
        }
      }
      // ===========================
      else if(this.currentRow > endRow) {
        this.currentRow--;
      }
    }
    else {
      // ===========================
      if(shuffle) {
        let randNum: number = -1;
        if(this.playedIndices?.length) {
          let foundIndex = this.playedIndices.findIndex(num => num == this.currentRow);
          if(foundIndex > -1 && foundIndex < this.playedIndices?.length - 1) {
            randNum = this.playedIndices[foundIndex + 1];
          }
          else {
            randNum = this.getRandomRow();
          }
        }
        if(randNum > -1) {
          this.currentRow = randNum;
        } else {
          return;
        }
      }
      // ===========================
      else if(this.currentRow < endRow) {
        this.currentRow++;
      }
    }
    if(reverseSpeechOrder) {
      this.currentColumn = this.tableData[0]?.length - 2;
    }
    else {
      this.currentColumn = 0;
    }
    
    this.highlightWord(this.currentRow-1, this.currentColumn);
    this.refreshPlaybackButtons();

    this.isSpeaking = false;
    this.speechService.stopSpeech();
    // this.speechService.pauseSpeech();
    this.killPlayAllText = true;
    this.skipSubject.next();
  }

  resume() {
    this.isSpeaking = true;
    this.speechService.resumeSpeech();
    this.refreshPlaybackButtons();
  }

  pause() {
    this.isSpeaking = false;
    this.speechService.pauseSpeech();
    this.refreshPlaybackButtons();
  }

  play() {
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
    this.playbackForm.get('languageColumns')?.disable();
    this.playbackForm.get('speakOnlyColumnVal')?.disable();
    this.playbackForm.get('speakOnlyColumnCheck')?.disable();
    this.currentRow = Number(this.playbackForm.get('startRow')?.value);
    let reverseSpeechOrder: boolean = this.playbackForm?.get('reverseSpeechOrder')?.value;
    if(reverseSpeechOrder) {
      this.currentColumn = this.tableData[0]?.length - 2;
    }
    else {
      this.currentColumn = 0;
    }
    this.playAllTexts(0, false);
    this.setupMediaControls();
  }

  stop() {
    this.isSpeaking = false;
    this.isStopped = true;
    this.refreshPlaybackButtons();
    this.playbackForm.get('startRow')?.enable();
    this.playbackForm.get('endRow')?.enable();
    this.playbackForm.get('sheetId')?.enable();
    this.playbackForm.get('languageColumns')?.enable();
    this.playbackForm.get('speakOnlyColumnVal')?.enable();
    this.playbackForm.get('speakOnlyColumnCheck')?.enable();
    this.highlightWord(-1, -1);
    this.speechService.stopSpeech();
    this.playedIndices = [];
  }

  rewindClick() {
    this.rewind();
    this.mediaControlService.play();
  }

  forwardClick() {
    this.forward();
    this.mediaControlService.play();
  }

  resumeClick() {
    this.resume();
    this.mediaControlService.play();
  }

  pauseClick() {
    this.pause();
    this.mediaControlService.pause();
  }

  playClick() {
    this.play();
    this.mediaControlService.play();
  }

  stopClick() {
    this.stop();
    this.mediaControlService.pause();
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
        const subSheetMatch = input.match(/gid=([a-zA-Z0-9-_]+)/);
        if(subSheetMatch) {
          this.playbackForm.get('subSheetId')?.setValue(subSheetMatch[1]);
          this.spreadsheetService.setSubSheetId(this.playbackForm.get('subSheetId')?.value);
        }
      }
      this.spreadsheetService.setSheetId(this.playbackForm.get('sheetId')?.value);
      this.numberOfLanguages = Number(this.playbackForm.get('languageColumns')?.value);
      await this.fetchData();
      this.patchForm();
      this.refreshPlaybackButtons();
      // this.loadSavedData();
    }
  }

  async loadSavedData(): Promise<void> {
    return new Promise((resolve, reject) => {
      let localStorageData = JSON.parse(localStorage.getItem('formData') || '{}');
      let savedData = JSON.parse(JSON.stringify(localStorageData));
      if(!savedData || Utils.isEmpty(savedData)) {
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
    if(savedData['speakOnlyColumnVal'] && Number(savedData['speakOnlyColumnVal']) <= this.tableData[0]?.length - 1)
    {
      this.playbackForm.get('speakOnlyColumnVal')?.patchValue(Number(savedData['speakOnlyColumnVal']));
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
    if(savedData['wordPauses'] && Number(savedData['wordPauses']) >= this.wordPausesRange.min && Number(savedData['wordPauses']) <= this.wordPausesRange.max)
    {
      this.playbackForm.get('wordPauses')?.patchValue(Number(savedData['wordPauses']));
    }
    this.playbackForm.get('speakOnlyColumnCheck')?.patchValue(this.checkForTruthy(savedData['speakOnlyColumnCheck']));
    this.playbackForm.get('lightMode')?.patchValue(this.checkForTruthy(savedData['lightMode']));
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

    if(savedData['languageColumns'] && 
      Number(savedData['languageColumns']) <= this.configService.getConfigValue("numberOfLanguagesMax") && 
      Number(savedData['languageColumns']) >= this.configService.getConfigValue("numberOfLanguages"))
    {
      this.playbackForm.get('languageColumns')?.patchValue(Number(savedData['languageColumns']));
    }
  }

  checkForTruthy(val: any) {
    let result = (typeof(val) == 'boolean' && Boolean(val)) || (typeof(val) == 'string' && val == 'true');
    return result;
  } 

  highlightWord(row: number, col: number) {
    const prevElemnt = document.getElementById(`cell_${this.highlightedRow}_${this.highlightedCol}`);
    if(prevElemnt) {
      this.renderer.removeClass(prevElemnt, 'highlight');
    }

    this.highlightedRow = row;
    this.highlightedCol = col;

    const container = document.getElementById('table-container');
    const element = document.getElementById(`cell_${row}_${col}`);

    if(element) {
      this.renderer.addClass(element, 'highlight');
    }

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
    if(this.playbackForm?.get("speakOnlyColumnCheck")?.value && this.playbackForm?.get("speakOnlyColumnVal")?.value != this.currentColumn + 1) {
      return;
    }
    
    let isSilentRow = this.symbolFound("SilentRowSymbol", this.tableData[this.currentRow]);
    if(isSilentRow) {
      return;
    }

    let text = this.tableData[this.currentRow][this.currentColumn];
    let voice: SpeechSynthesisVoice | undefined = this.getSpeechSynthesisVoice(`lang${this.currentColumn + 1}Voice`);
    let vocalSpeed = Number(this.playbackForm?.get('vocalSpeed')?.value);
    let wordPauses = Number(this.playbackForm?.get('wordPauses')?.value);

    if(text && voice) {
      this.addToPlayed(this.currentRow);
      if(wordPauses <= 0) {
        await this.speechService.speakAsync(text, voice, vocalSpeed);
      }
      else {
        await this.speakWithPauses(text, voice, vocalSpeed, wordPauses);
      }
    }
  }

  async speakWithPauses(text: string, voice: SpeechSynthesisVoice, vocalSpeed: number, wordDelay: number) {
    let isWordPausesEnabled = this.symbolFound(`Column${this.currentColumn+1}WordPausesEnabledSymbol`, this.tableData[this.currentRow]);
    if(isWordPausesEnabled){
      await this.speechService.speakAsync(text, voice, vocalSpeed, wordDelay*1000);
    } else {
      await this.speechService.speakAsync(text, voice, vocalSpeed);
    }
  }

  async playAllTexts(initialDelay: number, setNextCell: boolean): Promise<void> {
    await this.waitForPreviousPlayAllTextToFinish();
    this.playAllTextsStackCount++;
    if(this.isStopped) {
      this.highlightWord(-1, -1);
      this.playbackForm.get('startRow')?.enable();
      this.playbackForm.get('endRow')?.enable();
      this.playbackForm.get('sheetId')?.enable();
      this.playbackForm.get('languageColumns')?.enable();
      this.playbackForm.get('speakOnlyColumnVal')?.enable();
      this.playbackForm.get('speakOnlyColumnCheck')?.enable();
      this.playedIndices = [];
      this.playAllTextsStackCount--;
      return;
    }

    if(this.playAllTextsStackCount > 1) {
      this.playAllTextsStackCount--;
      return;
    }

    let shouldContinue = await this.delay(initialDelay);
    if(!shouldContinue) {
      this.playAllTextsStackCount--;
      return;
    }

    if(setNextCell) {
      this.setNextCell();
    }

    if(this.speechTerminationCriteria()) {
      this.highlightWord(this.currentRow-1, this.currentColumn);
      let reverseSpeechOrder: boolean = this.playbackForm?.get('reverseSpeechOrder')?.value;
      await this.speakNow();
      if(reverseSpeechOrder) {
        if(this.currentColumn > 0) {
          let delay = Number(this.playbackForm.get('inbetweenDelayColumn')?.value);
          this.playAllTextsStackCount--;
          return this.playAllTexts(delay*1000, true);
        }
        else {
          let delay = Number(this.playbackForm.get('inbetweenDelayRow')?.value);
          this.playAllTextsStackCount--;
          return this.playAllTexts(delay*1000, true);
        }
      }
      else {
        if(this.currentColumn < this.tableData[0]?.length - 2) {
          let delay = Number(this.playbackForm.get('inbetweenDelayColumn')?.value);
          this.playAllTextsStackCount--;
          return this.playAllTexts(delay*1000, true);
        }
        else {
          let delay = Number(this.playbackForm.get('inbetweenDelayRow')?.value);
          this.playAllTextsStackCount--;
          return this.playAllTexts(delay*1000, true);
        }
      }
    }
    else {
      let repeat = this.playbackForm?.get('repeat')?.value;
      if(repeat) {
        this.playedIndices = [];
        this.playAllTextsStackCount--;
        this.play();
      }
      else {
        this.isSpeaking = false;
        this.isStopped = true;
        this.refreshPlaybackButtons();
        this.playbackForm.get('startRow')?.enable();
        this.playbackForm.get('endRow')?.enable();
        this.playbackForm.get('sheetId')?.enable();
        this.playbackForm.get('languageColumns')?.enable();
        this.playbackForm.get('speakOnlyColumnVal')?.enable();
        this.playbackForm.get('speakOnlyColumnCheck')?.enable();
        this.highlightWord(-1, -1);
        this.playedIndices = [];
        this.playAllTextsStackCount--;
        return;
      }
    }
  }

  delay(val: number): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      if(!val) {
        if(this.killPlayAllText || this.isStopped) {
          resolve(false);
        } else if (this.isPaused) {
          const interval = setInterval(() => {
            if(!this.isPaused && !this.isStopped) {
              clearInterval(interval);
              resolve(true);
            } else if (this.isStopped) {
              resolve(false);
            }
          }, 10);
        } 
        else {
          resolve(true);
        }
      } else {
        let tillNow: number = 0;
        const interval = setInterval(() => {
          if(!this.isPaused) {
            tillNow += 10;
          }
          if (tillNow >= val) {
            clearInterval(interval);
            resolve(true);
          }
          if(this.killPlayAllText || this.isStopped) {
            clearInterval(interval);
            resolve(false);
          }
        }, 10);
      }
    });
  }

  waitForPreviousPlayAllTextToFinish(): Promise<void> {
    return new Promise<void>(resolve => {
      let interval = setInterval(() => {
        if(this.playAllTextsStackCount <= 0) {
          clearTimeout(interval);
          resolve();
        }
      }, 10);
    });
  }

  setNextCell() {
    let reverse: boolean = this.playbackForm?.get('reversePlayback')?.value;
    let shuffle: boolean = this.playbackForm?.get('shuffle')?.value;
    let reverseSpeechOrder: boolean = this.playbackForm?.get('reverseSpeechOrder')?.value;

    if(reverse) {
      if(reverseSpeechOrder) {
        if(this.currentColumn == 0) {
          this.currentColumn = this.tableData[0]?.length - 2;
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
        if(this.currentColumn == this.tableData[0]?.length - 2) {
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
          this.currentColumn = this.tableData[0]?.length - 2;
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
        if(this.currentColumn == this.tableData[0]?.length - 2) {
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
        // console.log('Retrying Wake Lock...');
        this.applyScreenOn();
      }
    }, 1000);
  }

  async applyScreenOn(): Promise<void> {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        // console.log('Screen Wake Lock activated');
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
      // console.log('Screen Wake Lock released');
    }
  }

  addToPlayed(val: number) {
    if(!this.playedIndices.includes(val)) {
      this.playedIndices.push(val);
    }
  }

  getRandomRow(): number {
    let shuffle: boolean = this.playbackForm?.get('shuffle')?.value;
    let nextIndex: number = -1;
    if(shuffle) {
      if(this.playedIndices?.length) {
        let foundIndex = this.playedIndices.findIndex(num => num == this.currentRow);
        if(foundIndex > -1 && foundIndex < this.playedIndices?.length - 1) {
          nextIndex = this.playedIndices[foundIndex + 1];
        }
      }
    }
    if (nextIndex == -1) {
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
    return nextIndex;
  }

  refreshButtonsWithshuffle() {
    if(this.playbackForm.get('shuffle')?.value)
    {
      // this.setButtonDisabledStatus('forward', true);
      // this.setButtonDisabledStatus('backward', true);
      this.setButtonDisabledStatus('reverse', true);
    }
    else {
      // this.setButtonDisabledStatus('forward', false);
      // this.setButtonDisabledStatus('backward', false);
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
    else if(controlName == "wordPauses") {
      this.playbackForm.get(controlName)?.setValue(this.wordPausesRange.min);
    }
  }

  async resetToDefaults() {
    this.playbackForm.get('sheetId')?.patchValue(this.configService.getConfigValue("googleSheetsId"));
    this.spreadsheetService.setSheetId(this.playbackForm.get('sheetId')?.value);
    this.spreadsheetService.setSubSheetId('');
    this.playbackForm.get('languageColumns')?.patchValue(this.configService.getConfigValue("numberOfLanguages"));
    this.numberOfLanguages = Number(this.playbackForm.get('languageColumns')?.value);
    this.playbackForm.disable();
    this.playbackForm.get('sheetId')?.enable();
    this.playbackForm.get('languageColumns')?.enable();
    let data = await this.fetchDataAndParseAsync().catch(err => {
      LoadingUtil.setStatus("app-data-table", false);
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
    this.playbackForm.get('speakOnlyColumnCheck')?.setValue(false);
    this.playbackForm.get('speakOnlyColumnVal')?.setValue(1);
    if(this.tableData?.length) {
      this.playbackForm.get('startRow')?.setValue(1);
      this.playbackForm.get('endRow')?.setValue(this.tableData?.length - 1);
      this.refreshRowFieldsValidity();
    }
    this.resetRangeSlider("wordPauses");
    this.playbackForm.get('lightMode')?.setValue(false);
    this.resetRangeSlider("inbetweenDelayRow");
    this.resetRangeSlider("inbetweenDelayColumn");
    this.resetRangeSlider("vocalSpeed");
    for(let i = 0; i < Number(this.configService.getConfigValue("numberOfLanguagesMax")); i++) {
      this.removeLanguageControl(i);
    }
    for(let i = 0; i < this.numberOfLanguages; i++) {
      this.addLanguageControl(i);
    }
    this.initializeDropdowns();
    this.refreshPlaybackButtons();
  }

  async speakSingle(row: number) {
    if(this.getButtonVisibility('stop')) {
      this.stopClick();
    }
    else {
      this.speechService.stopSpeech();
      this.isSpeaking = false;
    }
    
    if(!this.isSpeaking)
    {
      let text = this.tableData[row][0];
      let voice: SpeechSynthesisVoice | undefined = this.getSpeechSynthesisVoice(`lang${1}Voice`);
      let vocalSpeed = Number(this.playbackForm?.get('vocalSpeed')?.value);
      
      if(text && voice) {
        this.isSpeaking = true;
        await this.speechService.speakAsync(text, voice, vocalSpeed);
        this.isSpeaking = false;
      }
    }
  }

  ngOnDestroy(): void {
      this.releaseScreenOn();
      if(!this.getButtonDisabledStatus('stop')) {
        this.stop();
      }
  }

}
