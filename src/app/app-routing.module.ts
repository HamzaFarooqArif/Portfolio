import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PortfolioComponent } from './components/portfolio/portfolio.component';
import { LoadingUtil } from './utilities/loading/LoadingUtil';

const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: PortfolioComponent },
  {
    path: 'readaloud',
    loadChildren: () => {
      LoadingUtil.setStatus("app-routing", true);
      return import('./read-aloud/read-aloud.module').then(m => {
        LoadingUtil.setStatus("app-routing", false);
        return m.ReadAloudModule;
      });
    }
  },
  { path: 'consultancy', loadChildren: () => import('./consultancy/consultancy.module').then(m => m.ConsultancyModule) },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
