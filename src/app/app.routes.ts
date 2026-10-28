import { Routes } from '@angular/router';
import { LoginPageComponent } from './auth/login-page.component';
import { RegisterPageComponent } from './auth/register-page.component';
import { HealthPageComponent } from './health/health-page.component';
import { NotFoundComponent } from './not-found/not-found.component';

// The dev server answers every unknown path with index.html, so the router has to reject the rest
// itself. The root stays public: the health endpoint needs no token.
export const routes: Routes = [
  { path: '', pathMatch: 'full', component: HealthPageComponent, title: 'Service health' },
  { path: 'login', component: LoginPageComponent, title: 'Sign in' },
  { path: 'register', component: RegisterPageComponent, title: 'Sign up' },
  { path: '**', component: NotFoundComponent, title: 'Page not found' },
];
