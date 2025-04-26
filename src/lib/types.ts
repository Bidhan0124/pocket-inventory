
import type * as z from 'zod';
import type { productSchema } from '@/components/add-product-form'; // Import schema

export interface Product {
  id: string;
  name: string; // Name is now mandatory
  // company?: string; // Removed company field
  costPrice: number;
  sellingPrice: number;
  maxDiscount?: number; // Max discount is now optional
  imageUrl?: string;
  createdAt: Date;
  isOffline?: boolean; // Optional flag for UI indication
}

export interface Company {
    id: string;
    name: string;
    nameLower?: string; // Optional: For case-insensitive querying
    createdAt?: Date; // Optional: Tracking when added
}

// Define the type based on the Zod schema in AddProductForm
// Removed company field from schema, so it's removed here too.
export type AddProductFormData = z.infer<typeof productSchema>;

// Type for controlling the product list view
export type ViewMode = 'grid' | 'list';
