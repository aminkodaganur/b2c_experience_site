import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ToastService } from './services/toast.service';
import { CheckoutStepperComponent } from './checkout-stepper/checkout-stepper.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet, CheckoutStepperComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'B2C Experience App';

  constructor(public toast: ToastService) {}
}
