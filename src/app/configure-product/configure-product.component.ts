import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SalesforceApiService } from '../services/salesforce-api.service';

type TabId = 'display' | 'graphics' | 'memory' | 'processor' | 'storage';

interface ConfigOption {
  id: string;
  label: string;
  value: string;
}

interface ProductConfig {
  id: string | number;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  imageError?: boolean;
}

@Component({
  selector: 'app-configure-product',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './configure-product.component.html',
  styleUrl: './configure-product.component.scss'
})
export class ConfigureProductComponent {
  id: string | null = null;
  product: ProductConfig | null = null;
  quantity = 1;
  activeTab: TabId = 'display';

  // Tab options (Display, Graphics, Memory, Processor, Storage)
  displayOptions: ConfigOption[] = [
    { id: 'display', label: '2k Built-in Display', value: '2k Built-in Display' },
    { id: 'display', label: '1080p Built-in Display', value: '1080p Built-in Display' },
    { id: 'display', label: '4k Built-in Display', value: '4k Built-in Display' }
  ];
  screenSizeOptions: ConfigOption[] = [
    { id: 'screenSize', label: '24 Inch', value: '24 Inch' },
    { id: 'screenSize', label: '15.6 Inch', value: '15.6 Inch' },
    { id: 'screenSize', label: '17 Inch', value: '17 Inch' }
  ];
  graphicsOptions: ConfigOption[] = [
    { id: 'graphics', label: 'Intel Iris Xe Graphics', value: 'Intel Iris Xe Graphics' },
    { id: 'graphics', label: 'NVIDIA GeForce RTX 3060', value: 'NVIDIA GeForce RTX 3060' },
    { id: 'graphics', label: 'AMD Radeon Graphics', value: 'AMD Radeon Graphics' }
  ];
  memoryOptions: ConfigOption[] = [
    { id: 'memory', label: 'RAM 8GB', value: 'RAM 8GB' },
    { id: 'memory', label: 'RAM 16GB', value: 'RAM 16GB' },
    { id: 'memory', label: 'RAM 32GB', value: 'RAM 32GB' }
  ];
  processorOptions: ConfigOption[] = [
    { id: 'processor', label: 'i5-CPU 4.4GHz', value: 'i5-CPU 4.4GHz' },
    { id: 'processor', label: 'i7-CPU 5.0GHz', value: 'i7-CPU 5.0GHz' },
    { id: 'processor', label: 'i9-CPU 5.2GHz', value: 'i9-CPU 5.2GHz' }
  ];
  storageOptions: ConfigOption[] = [
    { id: 'storage', label: 'SSD Hard Drive 256GB', value: 'SSD Hard Drive 256GB' },
    { id: 'storage', label: 'SSD Hard Drive 512GB', value: 'SSD Hard Drive 512GB' },
    { id: 'storage', label: 'SSD Hard Drive 1TB', value: 'SSD Hard Drive 1TB' }
  ];

  selectedDisplay = '2k Built-in Display';
  selectedScreenSize = '24 Inch';
  selectedGraphics = 'Intel Iris Xe Graphics';
  selectedMemory = 'RAM 8GB';
  selectedProcessor = 'i5-CPU 4.4GHz';
  selectedStorage = 'SSD Hard Drive 256GB';

  products: Record<number, ProductConfig> = {
    1: { id: 1, name: 'Wireless Headphones', description: 'Noise-cancelling over-ear headphones with 20h battery life.', price: 49.99, imageUrl: 'https://picsum.photos/seed/product1/400/300' },
    2: { id: 2, name: 'Laptop', description: 'Battery- or AC-powered personal computer (PC) smaller than a briefcase.', price: 1049.00, imageUrl: 'https://picsum.photos/seed/laptop/400/300' },
    3: { id: 3, name: 'Cotton T-Shirt', description: '100% organic cotton, unisex fit.', price: 19.99, imageUrl: 'https://picsum.photos/seed/product3/400/300' },
    4: { id: 4, name: 'Garden Chair', description: 'Weather-resistant outdoor folding chair.', price: 79.99, imageUrl: 'https://picsum.photos/seed/product4/400/300' },
    5: { id: 5, name: 'Yoga Mat', description: 'Non-slip, eco-friendly mat with carry strap.', price: 24.99, imageUrl: 'https://picsum.photos/seed/product5/400/300' }
  };

  tabs: { id: TabId; label: string }[] = [
    { id: 'display', label: 'Display' },
    { id: 'graphics', label: 'Graphics' },
    { id: 'memory', label: 'Memory' },
    { id: 'processor', label: 'Processor' },
    { id: 'storage', label: 'Storage' }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private salesforceApi: SalesforceApiService
  ) {
    this.route.params.subscribe(p => {
      this.id = p['id'] || null;
      if (!this.id) {
        this.product = null;
        return;
      }
      const fromSalesforce = this.salesforceApi.getProductById(this.id);
      if (fromSalesforce) {
        this.product = {
          id: fromSalesforce.id,
          name: fromSalesforce.name,
          description: fromSalesforce.description,
          price: fromSalesforce.price,
          imageUrl: fromSalesforce.imageUrl,
          imageError: fromSalesforce.imageError,
        };
        return;
      }
      const numId = Number(this.id);
      if (!Number.isNaN(numId) && this.products[numId]) {
        this.product = this.products[numId];
        return;
      }
      this.product = null;
    });
  }

  setActiveTab(tabId: TabId): void {
    this.activeTab = tabId;
  }

  get summaryAttributes(): { label: string; value: string }[] {
    return [
      { label: 'Display', value: this.selectedDisplay },
      { label: 'Graphics', value: this.selectedGraphics },
      { label: 'Memory', value: this.selectedMemory },
      { label: 'Processor', value: this.selectedProcessor },
      { label: 'Screen Size', value: this.selectedScreenSize },
      { label: 'Storage', value: this.selectedStorage }
    ];
  }

  get oneTimeTotal(): number {
    return this.product ? this.product.price * this.quantity : 0;
  }
  get monthlyTotal(): number {
    return this.oneTimeTotal / 12;
  }
  get annualTotal(): number {
    return this.oneTimeTotal;
  }
  get quarterlyTotal(): number {
    return this.oneTimeTotal / 4;
  }
  get semiAnnualTotal(): number {
    return this.oneTimeTotal / 2;
  }

  onImageError(): void {
    if (this.product) this.product.imageError = true;
  }

  cancel(): void {
    this.router.navigate(['/product', this.product?.id ?? '']);
  }

  updatePrices(): void {
    // In a real app, recalculate from server
    return;
  }

  saveAndExit(): void {
    alert(`Configuration saved. ${this.quantity} x ${this.product?.name} added to quote.`);
    this.router.navigate(['/cart']);
  }
}
