import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'sidebar',
    loadComponent: () => import('./components/sidebar-page/sidebar-page.component').then(m => m.SidebarPageComponent)
  },
  {
    path: 'context-menu',
    loadComponent: () => import('./components/context-menu-page/context-menu-page.component').then(m => m.ContextMenuPageComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
