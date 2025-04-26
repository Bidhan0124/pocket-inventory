export interface Product {
  id: string;
  name?: string;
  company?: string;
  costPrice: number;
  sellingPrice: number;
  maxDiscount: number;
  imageUrl?: string;
  createdAt: Date;
}
