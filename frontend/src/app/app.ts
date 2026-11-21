import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidenav } from './layout/sidenav/sidenav';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Sidenav],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './app.html',
})
export class App {}
