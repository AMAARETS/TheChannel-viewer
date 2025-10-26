import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddSiteDialog } from './add-site-dialog';

describe('AddSiteDialog', () => {
  let component: AddSiteDialog;
  let fixture: ComponentFixture<AddSiteDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddSiteDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddSiteDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
