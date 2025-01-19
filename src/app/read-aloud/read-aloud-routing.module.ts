import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DataTableComponent } from './components/data-table/data-table.component';
import { MatButtonModule } from '@angular/material/button';

const routes: Routes = [
  { path: '', component: DataTableComponent }
];

@NgModule({
  imports: [
    RouterModule.forChild(routes)
  ],
  exports: [RouterModule]
})
export class ReadAloudRoutingModule { }