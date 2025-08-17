import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentNetworkComponent } from './student-network.component';

describe('StudentNetworkComponent', () => {
  let component: StudentNetworkComponent;
  let fixture: ComponentFixture<StudentNetworkComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StudentNetworkComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(StudentNetworkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
