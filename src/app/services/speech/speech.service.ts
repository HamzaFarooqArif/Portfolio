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

  public get easySpeechSpeaking() {
    return (EasySpeech.status() as any)?.speechSynthesis?.speaking;
  }

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
    return new Promise((resolve) => {
      
      let alreadyResolved: boolean = false;
      let interval2 = setInterval(() => {
        if(!this.isPaused && !alreadyResolved && !(EasySpeech.status() as any)?.speechSynthesis?.speaking) {
          clearInterval(interval2);
          resolve();
        }
        else if(alreadyResolved) {
          clearInterval(interval2);
        }
      }, 200);

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
                    alreadyResolved = true;
                    resolve();
                  }
                }, 10);
              }
              else {
                alreadyResolved = true;
                resolve();
              }
            })
            .catch((err) => {

            });
        }
      }, 10);
    });
  }

  stopSpeech() {
    this.isPaused = false;
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
