import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DataTableComponent } from './data-table.component';
import { HttpClientModule } from '@angular/common/http';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ReactiveFormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ToastrModule } from 'ngx-toastr';
import { NgxLoadingModule } from 'ngx-loading';

describe('DataTableComponent', () => {
  let component: DataTableComponent;
  let fixture: ComponentFixture<DataTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DataTableComponent],
      imports: [
        BrowserAnimationsModule,
        HttpClientModule,
        ReactiveFormsModule,
        MatSelectModule,
        MatFormFieldModule,
        MatFormFieldModule,
        MatInputModule,
        MatSliderModule,
        MatCheckboxModule,
        MatIconModule,
        ToastrModule.forRoot(),
        NgxLoadingModule.forRoot({}),
      ],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            // Mock any parameters, queryParams, or data used in your component
            params: of({ id: 1 }), // Example route parameter
            queryParams: of({ key: 'value' }), // Example query parameter
            snapshot: {
              data: { example: 'data' } // Example snapshot data
            }
          }
        }
      ]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DataTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
