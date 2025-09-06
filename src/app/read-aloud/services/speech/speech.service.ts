import { Injectable } from '@angular/core';
import EasySpeech from 'easy-speech'
import { Utils } from '../../utils/Utils';

@Injectable({
  providedIn: 'root'
})
export class SpeechService {
  private _maxTimeout: number = 5000;
  private _interval: number = 250;
  
  private isPaused: boolean = false;
  private cancelOngoingSpeech: boolean = false;

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

  async speakAsync(text: string, voice: SpeechSynthesisVoice, vocalSpeed: number, wordDelay: number = 0): Promise<void> {
    if(wordDelay > 0) {
      const words = text.split(" ");
      for (let i = 0; i < words.length; i++) {
        if(!this.cancelOngoingSpeech) {
          await this.speakInternalAsync(words[i], voice, vocalSpeed);
          await Utils.delay(wordDelay); 
        }
      }
      if(!this.cancelOngoingSpeech) {
        await this.speakInternalAsync(text, voice, vocalSpeed);
      }
      if(this.cancelOngoingSpeech) this.cancelOngoingSpeech = false;
    }
    else {
      await this.speakInternalAsync(text, voice, vocalSpeed);
    }
  }

  private async speakInternalAsync(text: string, voice: SpeechSynthesisVoice, vocalSpeed: number): Promise<void> {
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
            rate: vocalSpeed,
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
    this.cancelOngoingSpeech = true;
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
