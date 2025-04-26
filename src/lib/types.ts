
import type * as z from 'zod';
import type { productSchema } from '@/components/add-product-form'; // Import schema

export interface Product {
  id: string;
  name?: string;
  company?: string; // Company name as string
  costPrice: number;
  sellingPrice: number;
  maxDiscount: number;
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
export type AddProductFormData = z.infer<typeof productSchema>;

