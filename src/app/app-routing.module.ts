import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VocabularyTableComponent } from './components/vocabulary-table/vocabulary-table.component';

const routes: Routes = [
  { path: '', redirectTo: '/vocabulary', pathMatch: 'full' },
  { path: 'vocabulary', component: VocabularyTableComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
