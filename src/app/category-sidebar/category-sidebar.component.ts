import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface CategoryItem {
  id: string;
  label: string;
}

/** Static fallback when no catalog is selected (no GraphQL categories). */
const STATIC_CATEGORIES: CategoryItem[] = [
  { id: 'all', label: 'All Products' },
  { id: 'laptops', label: 'Laptops' },
  { id: 'desktops', label: 'Desktops' },
  { id: 'accessories', label: 'Accessories' }
];

@Component({
  selector: 'app-category-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './category-sidebar.component.html',
  styleUrl: './category-sidebar.component.scss'
})
export class CategorySidebarComponent {
  /** Categories to show. When null/empty, use static list. When set (from GraphQL), show "All Products" + these. */
  @Input() categories: CategoryItem[] | null = null;

  /** Currently selected category id (e.g. 'all' or a ProductCategory Id). */
  @Input() selectedCategoryId: string = 'all';

  /** Emitted when user selects a category. */
  @Output() categoryChange = new EventEmitter<string>();

  /** Resolved list: "All Products" plus either API categories or static items. */
  get displayCategories(): CategoryItem[] {
    const list = this.categories?.length ? this.categories : STATIC_CATEGORIES;
    if (list === STATIC_CATEGORIES) return list;
    return [{ id: 'all', label: 'All Products' }, ...list];
  }

  selectCategory(id: string): void {
    this.selectedCategoryId = id;
    this.categoryChange.emit(id);
  }
}
