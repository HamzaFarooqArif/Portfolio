import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataTableComponent } from './components/data-table/data-table.component';
import { HttpClientModule } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ToastrModule } from 'ngx-toastr';
import { NgxLoadingModule } from 'ngx-loading';
import { ReadAloudRoutingModule } from './read-aloud-routing.module';

@NgModule({
  declarations: [
    DataTableComponent
  ],
  imports: [
      CommonModule,
      HttpClientModule,
      ReactiveFormsModule,
      MatSelectModule,
      MatFormFieldModule,
      MatFormFieldModule,
      MatInputModule,
      MatSliderModule,
      MatCheckboxModule,
      MatIconModule,
      MatExpansionModule,
      MatButtonModule,
      MatTooltipModule,
      MatSlideToggleModule,
      ToastrModule.forRoot(),
      NgxLoadingModule.forRoot({}),
      ReadAloudRoutingModule,
    ],
  providers: [
    
  ],
})
export class ReadAloudModule { }
