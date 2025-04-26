
import type * as z from 'zod';
import type { productSchema } from '@/components/add-product-form'; // Import schema

export interface Product {
  id: string;
  name: string; // Name is now mandatory
  company?: string; // Company name (optional)
  costPrice: number;
  sellingPrice: number;
  maxDiscount?: number; // Max discount is now optional
  imageUrl?: string;
  createdAt: Date;
  isOffline?: boolean; // Optional flag for UI indication
}

// Represents a company document in Firestore
export interface Company {
    id: string;
    name: string;
    nameLower: string; // For case-insensitive querying
    createdAt: Date;
}


// Define the type based on the Zod schema in AddProductForm
export type AddProductFormData = z.infer<typeof productSchema>;

// Type for controlling the product list view
export type ViewMode = 'grid' | 'list';

