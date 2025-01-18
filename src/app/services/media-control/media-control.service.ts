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


  private audio!: HTMLAudioElement;
  private playlist: any;
  private index: any;

  constructor() {
    this.init();
   }

  playDummyAudio() {
    this.audio.src = this.playlist[this.index].src;
    this.audio.play()
    // .then(_ => this.updateMetadata())
    .catch(error => console.log(error));
    this.audio.volume = 0;
  }

  getAwesomePlaylist() {
    const BASE_URL = 'https://storage.googleapis.com/media-session/';

    return [
      {
        src: BASE_URL + 'big-buck-bunny/prelude.mp3',
        title: 'Prelude',
        artist: 'Jan Morgenstern',
        album: 'Big Buck Bunny',
        artwork: [
          { src: BASE_URL + 'big-buck-bunny/artwork-96.png',  sizes: '96x96',   type: 'image/png' },
          { src: BASE_URL + 'big-buck-bunny/artwork-128.png', sizes: '128x128', type: 'image/png' },
          { src: BASE_URL + 'big-buck-bunny/artwork-192.png', sizes: '192x192', type: 'image/png' },
          { src: BASE_URL + 'big-buck-bunny/artwork-256.png', sizes: '256x256', type: 'image/png' },
          { src: BASE_URL + 'big-buck-bunny/artwork-384.png', sizes: '384x384', type: 'image/png' },
          { src: BASE_URL + 'big-buck-bunny/artwork-512.png', sizes: '512x512', type: 'image/png' },
        ]
      },
      {
        src: BASE_URL + 'sintel/snow-fight.mp3',
        title: 'Snow Fight',
        artist: 'Jan Morgenstern',
        album: 'Sintel',
        artwork: [
          { src: BASE_URL + 'sintel/artwork-96.png',  sizes: '96x96',   type: 'image/png' },
          { src: BASE_URL + 'sintel/artwork-128.png', sizes: '128x128', type: 'image/png' },
          { src: BASE_URL + 'sintel/artwork-192.png', sizes: '192x192', type: 'image/png' },
          { src: BASE_URL + 'sintel/artwork-256.png', sizes: '256x256', type: 'image/png' },
          { src: BASE_URL + 'sintel/artwork-384.png', sizes: '384x384', type: 'image/png' },
          { src: BASE_URL + 'sintel/artwork-512.png', sizes: '512x512', type: 'image/png' },
        ]
      }];
  }

  init() {
    this.audio = document.createElement('audio');

    this.playlist = this.getAwesomePlaylist();
    this.index = 0;

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      if (this.backwardCallback) {
        this.backwardCallback();
      }
      // this.index = (this.index - 1 + this.playlist.length) % this.playlist.length;
      // this.playAudio();
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      if (this.forwardCallback) {
        this.forwardCallback();
      }
      // this.index = (this.index + 1) % this.playlist.length;
      // this.playAudio();
    });

    navigator.mediaSession.setActionHandler('play', async () => {
      if (this.playCallback) {
        this.playCallback();
      }
      // await this.audio.play();
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      if (this.pauseCallback) {
        this.pauseCallback();
      }
      // this.audio.pause();
    });

    try {
      navigator.mediaSession.setActionHandler('stop', () => {
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
