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

  getLangsAsync(): Observable<SpeechSynthesisVoice[]> {
    return new Observable<SpeechSynthesisVoice[]>((observer) => {
      let interval = setInterval(() => {
        if(EasySpeech.status().status != 'created') {
          clearInterval(interval);
          observer.next(EasySpeech.voices());
          observer.complete();
        }
      }, 10);
    });
  }

  speakAsync(text: string, voice: SpeechSynthesisVoice, vocalSpeed: number = 1): Observable<void> {
    return new Observable<void>((observer) => {
      let interval = setInterval(() => {
        if(EasySpeech.status().status != 'created') {
          clearInterval(interval);
          EasySpeech.speak({
            text: text,
            voice: voice,
            rate: vocalSpeed,
            boundary: event => console.debug('word boundary reached', event.charIndex)
          })
            .then(() => {
              observer.next();
              observer.complete();
            })
            .catch((err) => {
              observer.error(err);
            });
        }
      }, 10);
    });
  }
}
