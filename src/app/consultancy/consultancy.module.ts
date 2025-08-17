import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ConsultancyRoutingModule } from './consultancy-routing.module';
import { ServicesComponent } from './services/services.component';
import { StudentNetworkComponent } from './student-network/student-network.component';
import { SuccessStoriesComponent } from './success-stories/success-stories.component';
import { WhyChooseComponent } from './why-choose/why-choose.component';
import {MatCardModule} from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatGridListModule } from '@angular/material/grid-list';
import { ApplyFormComponent } from './apply-form/apply-form.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';


@NgModule({
  declarations: [
    ServicesComponent,
    StudentNetworkComponent,
    SuccessStoriesComponent,
    WhyChooseComponent,
    ApplyFormComponent
  ],
  imports: [
    CommonModule,
    ConsultancyRoutingModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatGridListModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    FormsModule,
    MatInputModule,
  ]
})
export class ConsultancyModule { }
