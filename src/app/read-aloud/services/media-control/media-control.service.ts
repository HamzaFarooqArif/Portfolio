import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MediaControlService {
  public playCallback?: () => Promise<void>;
  public pauseCallback?: () => Promise<void>;
  public stopCallback?: () => Promise<void>;
  public forwardCallback?: () => Promise<void>;
  public backwardCallback?: () => Promise<void>;


  public userActionInitiated: boolean = false;
  private audio!: HTMLAudioElement;
  private playlist: any;
  private index: any;
  private beepDuration: number = 100;
  private beepVolumeLOW: number = 0.001;

  constructor() {
    this.init();
  }

  isSafari(): boolean {
    const ua = navigator.userAgent.toLowerCase();
    let result = ua.includes('safari') && !ua.includes('chrome') && !ua.includes('android');
    return result;
  }

  playDummyAudio() {
    if(!this.userActionInitiated) {
      this.userActionInitiated = true;
    }

    if(!this.isSafari()) {
      this.audio.src = this.playlist[this.index].src;
      this.audio.play()
      // .then(_ => this.updateMetadata())
      .catch(error => console.log(error));
      this.audio.volume = this.beepVolumeLOW;
    }
  }

  getAwesomePlaylist() {
    return [
      {
        src: '../../../assets/audio/tone1.mp3',
        title: 'tone1'
      }
    ];
  }

  async beep(iterations: number): Promise<void> {
    return new Promise(resolve => {
      if(iterations > 0) {
        this.audio.volume = 1;
        let timeout = setTimeout(() => {
          clearTimeout(timeout);
          this.audio.volume = this.beepVolumeLOW;
          this.beep(iterations - 1);
          resolve();
        }, this.beepDuration);
      }
    });
  }

  async pause() {
    if(!this.isSafari()) {
      this.audio.pause();
    }
  }

  async play() {
    if (!this.isSafari()) {
      await this.audio.play();
    }
  }

  init() {
    if(!this.isSafari()) {
      this.audio = document.createElement('audio');
  
      this.playlist = this.getAwesomePlaylist();
      this.index = 0;
  
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (this.backwardCallback) {
          this.backwardCallback()
          .then(x => this.play()
          .then(y => this.beep(1)));
        }
        // this.index = (this.index - 1 + this.playlist.length) % this.playlist.length;
        // this.playDummyAudio();
      });
  
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        if (this.forwardCallback) {
          this.forwardCallback()
          .then(x => this.play()
          .then(y => this.beep(1)));
        }
        // this.index = (this.index + 1) % this.playlist.length;
        // this.playDummyAudio();
      });
  
      navigator.mediaSession.setActionHandler('play', async () => {
        if (this.playCallback) {
          this.playCallback()
          .then(x => this.play()
          .then(_ => this.beep(1)));
        }
      });
  
      navigator.mediaSession.setActionHandler('pause', () => {
        if (this.pauseCallback) {
          this.pauseCallback()
          .then(x => this.beep(1)
          .then(_ => this.pause()));
        }
      });
  
      try {
        navigator.mediaSession.setActionHandler('stop', () => {
          if (this.stopCallback) {
            this.stopCallback()
            .then(x => this.beep(1)
            .then(_ => this.pause()));
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
}
