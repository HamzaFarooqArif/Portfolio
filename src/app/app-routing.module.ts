import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', redirectTo: '/readaloud', pathMatch: 'full' },
  {
    path: 'readaloud',
    loadChildren: () => import('./read-aloud/read-aloud.module').then(m => m.ReadAloudModule)
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
