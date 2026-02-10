import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SalesforceApiService, CatalogRecord } from '../services/salesforce-api.service';

@Component({
  selector: 'app-browse-catalog',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './browse-catalog.component.html',
  styleUrl: './browse-catalog.component.scss'
})
export class BrowseCatalogComponent implements OnInit {
  catalogs: CatalogRecord[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private router: Router,
    private salesforceApi: SalesforceApiService
  ) {}

  ngOnInit(): void {
    this.loadCatalogs();
  }

  loadCatalogs(): void {
    this.loading = true;
    this.error = null;
    this.salesforceApi.getCatalog().subscribe({
      next: (list) => {
        this.catalogs = list;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.message ?? 'Failed to load catalogs from Salesforce.';
        this.catalogs = [];
        this.loading = false;
      }
    });
  }

  selectCatalog(catalog: CatalogRecord): void {
    this.router.navigate(['/products'], { queryParams: { catalogId: catalog.id } });
  }
}
