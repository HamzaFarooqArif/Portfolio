import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ServicesComponent } from './services/services.component';
import { StudentNetworkComponent } from './student-network/student-network.component';
import { SuccessStoriesComponent } from './success-stories/success-stories.component';
import { WhyChooseComponent } from './why-choose/why-choose.component';
import { ApplyFormComponent } from './apply-form/apply-form.component';

const routes: Routes = [
  { path: 'services', component: ServicesComponent },
  { path: 'student-network', component: StudentNetworkComponent },
  { path: 'success-stories', component: SuccessStoriesComponent },
  { path: 'why-choose', component: WhyChooseComponent },
  { path: 'apply', component: ApplyFormComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ConsultancyRoutingModule { }
