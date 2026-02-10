import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CartService } from '../services/cart.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export class CartComponent {
  constructor(public cart: CartService) {}

  get items() {
    return this.cart.getItems();
  }

  get subtotal(): number {
    return this.cart.subtotal;
  }

  get total(): number {
    return this.cart.subtotal;
  }

  remove(id: string): void {
    this.cart.removeItem(id);
  }
}
