import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SalesforceApiService } from '../services/salesforce-api.service';
import { CartService } from '../services/cart.service';
import { AccountService } from '../services/account.service';

@Component({
  selector: 'app-register-account',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register-account.component.html',
  styleUrl: './register-account.component.scss'
})
export class RegisterAccountComponent {
  model = {
    name: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    phone: '',
    email: '',
    password: ''
  };
  submitting = false;
  error: string | null = null;

  constructor(
    private router: Router,
    private salesforceApi: SalesforceApiService,
    private cart: CartService,
    private account: AccountService
  ) {}

  onSubmit(): void {
    this.error = null;
    const { name, street, city, state, postalCode, country, phone, email, password } = this.model;
    if (!name?.trim() || !street?.trim() || !city?.trim() || !state?.trim() || !postalCode?.trim() || !country?.trim() || !phone?.trim() || !email?.trim() || !password) {
      this.error = 'All fields are required.';
      return;
    }
    const cartId = this.cart.getCartId();
    if (!cartId) {
      this.error = 'No cart found. Add items to cart first.';
      return;
    }
    this.submitting = true;
    this.salesforceApi
      .createAccount({
        Name: name.trim(),
        ShippingStreet: street.trim(),
        ShippingCity: city.trim(),
        ShippingState: state.trim(),
        ShippingPostalCode: postalCode.trim(),
        ShippingCountry: country.trim(),
        Phone: phone.trim(),
        Email__c: email.trim(),
        Password__c: password,
      })
      .subscribe({
        next: (res) => {
          const accountId = res.id;
          this.account.setAccountId(accountId);
          this.salesforceApi.updateWebCartAccountId(cartId, accountId).subscribe({
            next: () => {
              this.submitting = false;
              this.router.navigate(['/payment']);
            },
            error: (err) => {
              this.submitting = false;
              this.error = err?.message ?? 'Failed to link cart to account.';
            }
          });
        },
        error: (err) => {
          this.submitting = false;
          this.error = err?.message ?? 'Registration failed.';
        }
      });
  }
}
