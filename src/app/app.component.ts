import { Component, ViewChild } from '@angular/core';
import { MatSidenav } from '@angular/material/sidenav';
import { LoadingUtil } from './utilities/loading/LoadingUtil';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Portfolio';

  @ViewChild('sidenav') sidenav!: MatSidenav;
  
  get loading() {
    return LoadingUtil.isLoading();
  }

  constructor() {
    
  }

  toggleSidenav() {
    this.sidenav.toggle();
  }
}
