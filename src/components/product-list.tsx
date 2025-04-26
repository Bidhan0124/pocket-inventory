
"use client";

import type { Product, ViewMode } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton
import { motion } from "framer-motion"; // Import motion
import { Package, Building } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductListProps {
  products: (Product & { isOffline?: boolean })[]; // Add isOffline flag
  isLoading: boolean;
  viewMode: ViewMode; // Add viewMode prop
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

const GridSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
    {Array.from({ length: 6 }).map((_, index) => (
      <Card key={index} className="animate-pulse">
        <CardHeader className="flex flex-row items-center gap-4 pb-2">
           <Skeleton className="h-16 w-16 rounded-full" /> {/* Increased size */}
          <div className="flex-1 space-y-2">
             <Skeleton className="h-4 w-3/4 rounded" />
             <Skeleton className="h-3 w-1/2 rounded" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-2">
           <Skeleton className="h-3 w-full rounded" />
           <Skeleton className="h-3 w-5/6 rounded" />
           <Skeleton className="h-3 w-1/3 rounded" />
        </CardContent>
      </Card>
    ))}
  </div>
);

const ListSkeleton = () => (
    <div className="flex flex-col gap-4 p-4">
        {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="animate-pulse flex flex-row items-center gap-4 p-4">
                <Skeleton className="h-20 w-20 rounded-md" /> {/* Increased size */}
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-1/2 rounded" />
                    <Skeleton className="h-4 w-1/3 rounded" />
                    <div className="flex gap-4 pt-1">
                        <Skeleton className="h-3 w-1/4 rounded" />
                        <Skeleton className="h-3 w-1/4 rounded" />
                        <Skeleton className="h-3 w-1/4 rounded" />
                    </div>
                </div>
            </Card>
        ))}
    </div>
);

export function ProductList({ products, isLoading, viewMode }: ProductListProps) {
  if (isLoading) {
    return viewMode === 'grid' ? <GridSkeleton /> : <ListSkeleton />;
  }

  if (products.length === 0) {
    return <p className="text-center text-muted-foreground p-8">No products found.</p>;
  }

  return (
    <motion.div
      className={cn(
        "p-4",
        viewMode === 'grid'
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          : "flex flex-col gap-4" // List view classes
      )}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {products.map((product) => (
        <motion.div key={product.id} variants={itemVariants}>
           {viewMode === 'grid' ? (
              <GridViewCard product={product} />
            ) : (
              <ListViewCard product={product} />
            )}
        </motion.div>
      ))}
    </motion.div>
  );
}


// Grid View Card Component
const GridViewCard = ({ product }: { product: Product & { isOffline?: boolean }}) => (
    <Card className={cn(
        "relative overflow-hidden transition-shadow duration-200 hover:shadow-lg h-full flex flex-col", // Ensure card takes full height for grid consistency
         product.isOffline ? 'opacity-70 border-dashed border-primary' : ''
    )}>
         {product.isOffline && (
            <Badge variant="outline" className="absolute top-2 right-2 bg-background/80 text-xs backdrop-blur-sm z-10">Offline</Badge>
          )}
        <CardHeader className="flex flex-row items-center gap-4 pb-2">
            {/* Increased Avatar size */}
          <Avatar className="h-16 w-16 border">
            <AvatarImage src={product.imageUrl} alt={product.name || "Product Image"} />
            <AvatarFallback>
              <Package className="h-8 w-8 text-muted-foreground" />
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
        <CardContent className="text-xs space-y-1 pt-0 flex-grow"> {/* Allow content to grow */}
          <p>Cost: ₹{product.costPrice.toFixed(2)}</p>
          <p>Selling: ₹{product.sellingPrice.toFixed(2)}</p>
          {(product.maxDiscount ?? 0) > 0 && (
            <p>Max Discount: {product.maxDiscount}%</p>
          )}
        </CardContent>
    </Card>
);

// List View Card Component
const ListViewCard = ({ product }: { product: Product & { isOffline?: boolean }}) => (
     <Card className={cn(
         "relative overflow-hidden transition-shadow duration-200 hover:shadow-lg flex flex-row items-center gap-4 p-4",
          product.isOffline ? 'opacity-70 border-dashed border-primary' : ''
     )}>
         {product.isOffline && (
             <Badge variant="outline" className="absolute top-2 right-2 bg-background/80 text-xs backdrop-blur-sm z-10">Offline</Badge>
         )}
        {/* Larger, rectangular image for list view */}
        <div className="h-20 w-20 flex-shrink-0 border rounded-md overflow-hidden">
             <Avatar className="h-full w-full rounded-none">
                <AvatarImage src={product.imageUrl} alt={product.name || "Product Image"} className="object-cover h-full w-full" />
                <AvatarFallback className="rounded-none bg-muted flex items-center justify-center">
                    <Package className="h-10 w-10 text-muted-foreground" />
                </AvatarFallback>
            </Avatar>
        </div>

        <div className="flex-1 space-y-1 overflow-hidden">
            <CardTitle className="text-lg font-semibold truncate">{product.name || "Unnamed Product"}</CardTitle>
            {product.company && (
                <CardDescription className="text-sm flex items-center gap-1 truncate">
                  <Building className="h-4 w-4 inline-block flex-shrink-0" />
                  <span className="truncate">{product.company}</span>
                </CardDescription>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs pt-1 text-muted-foreground">
                <span>Cost: ₹{product.costPrice.toFixed(2)}</span>
                <span>Selling: ₹{product.sellingPrice.toFixed(2)}</span>
                {(product.maxDiscount ?? 0) > 0 && (
                    <span>Disc: {product.maxDiscount}%</span>
                )}
            </div>
        </div>
     </Card>
);
