import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { CartService } from '../services/cart.service';
import { AccountService } from '../services/account.service';
import { SalesforceApiService } from '../services/salesforce-api.service';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.scss'
})
export class PaymentComponent {
  model = {
    cardNumber: '',
    expiry: '',
    cvv: '',
    cardholderName: ''
  };
  submitting = false;
  error: string | null = null;
  success = false;

  constructor(
    private router: Router,
    private cart: CartService,
    private account: AccountService,
    private salesforceApi: SalesforceApiService
  ) {}

  onSubmit(): void {
    this.error = null;
    const cartId = this.cart.getCartId();
    if (!cartId) {
      this.error = 'No cart found.';
      return;
    }
    const accountId = this.account.getAccountId();
    if (!accountId) {
      this.error = 'Account not found. Please register or log in first.';
      return;
    }
    this.submitting = true;
    this.salesforceApi
      .updateWebCartAccountId(cartId, accountId)
      .pipe(switchMap(() => this.salesforceApi.checkout(cartId)))
      .subscribe({
        next: (res) => {
          this.submitting = false;
          if (res.orderId != null) {
            this.success = true;
            this.cart.clear();
            setTimeout(() => this.router.navigate(['/catalog']), 2500);
          } else {
            const msg = res.errors?.length
              ? res.errors.map((e) => e.errorMessage).join(' ')
              : 'We couldn\'t create the order. Please try again.';
            this.error = msg;
          }
        },
        error: (err) => {
          this.submitting = false;
          this.error = err?.message ?? 'Checkout failed.';
        }
      });
  }
}
