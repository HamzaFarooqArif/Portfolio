import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MediaControlService {
  public playCallback?: () => void;
  public pauseCallback?: () => void;
  public stopCallback?: () => void;
  public forwardCallback?: () => void;
  public backwardCallback?: () => void;


  public userActionInitiated: boolean = false;
  private audio!: HTMLAudioElement;
  private playlist: any;
  private index: any;
  private beepDuration: number = 100;

  constructor() {
    this.init();
  }

  playDummyAudio() {
    if(!this.userActionInitiated) {
      this.userActionInitiated = true;
    }

    this.audio.src = this.playlist[this.index].src;
    this.audio.play()
    // .then(_ => this.updateMetadata())
    .catch(error => console.log(error));
    this.audio.volume = 0.1;
  }

  getAwesomePlaylist() {
    return [
      {
        src: '../../../assets/audio/tone1.mp3',
        title: 'tone1'
      }
    ];
  }

  beep(iterations: number) {
    if(iterations > 0) {
      this.audio.volume = 1;
      let timeout = setTimeout(() => {
        clearTimeout(timeout);
        this.audio.volume = 0.1;
        this.beep(iterations - 1);
      }, this.beepDuration);
    }
  }

  init() {
    this.audio = document.createElement('audio');

    this.playlist = this.getAwesomePlaylist();
    this.index = 0;

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      this.beep(1);
      if (this.backwardCallback) {
        this.backwardCallback();
      }
      // this.index = (this.index - 1 + this.playlist.length) % this.playlist.length;
      // this.playAudio();
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      this.beep(1);
      if (this.forwardCallback) {
        this.forwardCallback();
      }
      // this.index = (this.index + 1) % this.playlist.length;
      // this.playAudio();
    });

    navigator.mediaSession.setActionHandler('play', async () => {
      this.beep(1);
      if (this.playCallback) {
        this.playCallback();
      }
      // await this.audio.play();
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      this.beep(1);
      if (this.pauseCallback) {
        this.pauseCallback();
      }
      // this.audio.pause();
    });

    try {
      navigator.mediaSession.setActionHandler('stop', () => {
        this.beep(1);
        if (this.stopCallback) {
          this.stopCallback();
        }
        setTimeout(() => {
          this.playDummyAudio();
        }, 10);
      });
    } catch(error) {
      console.log('Warning! The "stop" media session action is not supported.');
    }

    this.audio.addEventListener('ended', () => {
      // this.index = (this.index - 1 + this.playlist.length) % this.playlist.length;
      this.playDummyAudio();
    });

    this.audio.addEventListener('play', function() {
      navigator.mediaSession.playbackState = 'playing';
    });

    this.audio.addEventListener('pause', function() {
      navigator.mediaSession.playbackState = 'paused';
    });
  }
}
