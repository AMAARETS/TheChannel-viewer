import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideHttpClient } from '@angular/common/http'; // <-- דרך מודרנית לספק HttpClient

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient() // <-- רישום שירות ה-HttpClient עבור האפליקציה
  ]
}).catch(err => console.error(err));
