import { APP_INITIALIZER, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HashLocationStrategy, LocationStrategy, PathLocationStrategy } from '@angular/common';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ConfigService } from './read-aloud/services/config/config.service';
import { ToastrModule } from 'ngx-toastr';
import { NgxLoadingModule } from "ngx-loading";
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatSidenavModule} from '@angular/material/sidenav';
import {MatListModule} from '@angular/material/list';
import { PortfolioComponent } from './components/portfolio/portfolio.component';


export function loadAppConfig(configService: ConfigService): () => Promise<void> {
  return () =>
    configService
      .loadConfig()
      .toPromise()
      .then((config) => configService.setConfig(config));
}

@NgModule({
  declarations: [
    AppComponent,
    PortfolioComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    AppRoutingModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatSidenavModule,
    MatListModule,
    ToastrModule.forRoot(),
    NgxLoadingModule.forRoot({}),
  ],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: loadAppConfig,
      deps: [ConfigService],
      multi: true
    },
    {provide: LocationStrategy, useClass: PathLocationStrategy},
    provideAnimationsAsync(),
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
