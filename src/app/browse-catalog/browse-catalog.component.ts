import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-browse-catalog',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './browse-catalog.component.html',
  styleUrl: './browse-catalog.component.scss'
})
export class BrowseCatalogComponent {
  categories = [
    { id: 1, name: 'Electronics', description: 'Phones, Laptops & more' },
    { id: 2, name: 'Clothing', description: 'Apparel & accessories' },
    { id: 3, name: 'Home & Garden', description: 'Furniture & decor' },
    { id: 4, name: 'Sports', description: 'Sports gear & equipment' }
  ];

  constructor(private router: Router) {}

  selectCatalog(categoryId: number): void {
    this.router.navigate(['/products'], { queryParams: { categoryId } });
  }
}
