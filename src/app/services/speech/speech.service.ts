import { Injectable } from '@angular/core';
import EasySpeech from 'easy-speech'
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SpeechService {

  constructor() {
    this.init();
  }

  init() {
    EasySpeech.init({ maxTimeout: 5000, interval: 250 })
    .then(() => console.log('easy-speech load complete'))
    .catch(e => console.error(e));
  }

  getLangsAsync(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve) => {
      let interval = setInterval(() => {
        if(EasySpeech.status().status != 'created') {
          clearInterval(interval);
          resolve(EasySpeech.voices());
        }
      }, 10);
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
            rate: vocalSpeed ?? 1
          })
            .then(() => {
              resolve();
            })
            .catch((err) => {
              reject(err);
            });
        }
      }, 10);
    });
  }

  stopSpeech() {
    EasySpeech.cancel();
  }
}
