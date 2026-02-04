import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export class CartComponent {
  // Sample cart items – in a real app this would come from a cart service
  items = [
    { id: 1, name: 'Wireless Headphones', price: 49.99, quantity: 1 },
    { id: 3, name: 'Cotton T-Shirt', price: 19.99, quantity: 2 }
  ];

  get subtotal(): number {
    return this.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  }

  get total(): number {
    return this.subtotal;
  }
}
