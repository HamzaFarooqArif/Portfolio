import { Injectable } from '@angular/core';
import EasySpeech from 'easy-speech'
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SpeechService {
  private _maxTimeout: number = 5000;
  private _interval: number = 250;
  
  private isPaused: boolean = false;
  private isStopped: boolean = true;

  constructor() {
    this.init();
  }

  init(): Promise<boolean> {
    return EasySpeech.init({ maxTimeout: this._maxTimeout, interval: this._interval });
  }

  getLangsAsync(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve, reject) => {
      try {
        let result = EasySpeech.voices();
        resolve(result);
      }
      catch (error: any) {
        reject(error);
      }
    });
  }

  async speakAsync(text: string, voice: SpeechSynthesisVoice, vocalSpeed?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let interval = setInterval(() => {
        if(EasySpeech.status().status != 'created') {
          clearInterval(interval);
          EasySpeech.speak({
            text: text,
            voice: voice,
            rate: vocalSpeed ?? 1,
            boundary: event => console.debug('word boundary reached', event.charIndex),
          })
            .then(() => {
              if(this.isPaused) {
                let interval = setInterval(() => {
                  if(!this.isPaused) {
                    clearInterval(interval);
                    resolve();
                  }
                }, 10);
              }
              else {
                resolve();
              }
            })
            .catch((err) => {
              reject(err);
            });
        }
      }, 10);
    });
  }

  stopSpeech() {
    this.isPaused = false;
    this.isStopped = true;
    EasySpeech.cancel();
  }

  pauseSpeech() {
    this.isPaused = true;
    EasySpeech.pause();
  }

  resumeSpeech() {
    this.isPaused = false;
    EasySpeech.resume();
  }
}
