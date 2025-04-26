
"use client";

import type { Product } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion"; // Import motion
import { Package, Building } from "lucide-react";

interface ProductListProps {
  products: (Product & { isOffline?: boolean })[]; // Add isOffline flag
  isLoading: boolean;
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05, // Stagger animation for each item
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 12,
    },
  },
};

export function ProductList({ products, isLoading }: ProductListProps) {
  if (isLoading) {
    return (
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
         {Array.from({ length: 6 }).map((_, index) => (
           <Card key={index} className="animate-pulse">
             <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <div className="h-12 w-12 rounded-full bg-muted"></div>
               <div className="flex-1 space-y-1">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
               </div>
             </CardHeader>
             <CardContent className="space-y-2">
                <div className="h-3 bg-muted rounded w-full"></div>
                <div className="h-3 bg-muted rounded w-5/6"></div>
             </CardContent>
           </Card>
         ))}
       </div>
     );
  }

  if (products.length === 0) {
    return <p className="text-center text-muted-foreground p-8">No products found.</p>;
  }

  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {products.map((product) => (
        <motion.div key={product.id} variants={itemVariants}>
          <Card className={`relative overflow-hidden transition-shadow duration-200 hover:shadow-lg ${product.isOffline ? 'opacity-70 border-dashed border-primary' : ''}`}>
             {product.isOffline && (
                <Badge variant="outline" className="absolute top-2 right-2 bg-background/80 text-xs backdrop-blur-sm">Offline</Badge>
              )}
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <Avatar className="h-12 w-12 border">
                <AvatarImage src={product.imageUrl} alt={product.name || "Product Image"} />
                <AvatarFallback>
                  <Package className="h-6 w-6 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1 overflow-hidden">
                <CardTitle className="text-base font-semibold truncate">{product.name || "Unnamed Product"}</CardTitle>
                {product.company && (
                    <CardDescription className="text-xs flex items-center gap-1 truncate">
                      <Building className="h-3 w-3 inline-block flex-shrink-0" />
                      <span className="truncate">{product.company}</span>
                    </CardDescription>
                )}
              </div>
            </CardHeader>
            <CardContent className="text-xs space-y-1 pt-0">
              <p>Cost: ₹{product.costPrice.toFixed(2)}</p>
              <p>Selling: ₹{product.sellingPrice.toFixed(2)}</p>
              {/* Only display Max Discount if it's greater than 0 */}
              {(product.maxDiscount ?? 0) > 0 && (
                <p>Max Discount: {product.maxDiscount}%</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}
    