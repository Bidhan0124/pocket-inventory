
"use client";

import type { Product, ViewMode } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton
import { motion } from "framer-motion"; // Import motion
import { Package } from "lucide-react"; // Removed Building icon
import { cn } from "@/lib/utils";
import Image from 'next/image'; // Use next/image for better control

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
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
    {Array.from({ length: 6 }).map((_, index) => (
      <Card key={index} className="animate-pulse">
        {/* Rectangular skeleton for image */}
        <Skeleton className="w-full aspect-video rounded-t-md" />
        <CardHeader className="flex flex-row items-center gap-4 pb-2 pt-4">
          <div className="flex-1 space-y-2">
             <Skeleton className="h-5 w-3/4 rounded" /> {/* Adjusted height */}
             {/* Removed company skeleton */}
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
           <Skeleton className="h-4 w-full rounded" /> {/* Adjusted height */}
           <Skeleton className="h-4 w-5/6 rounded" /> {/* Adjusted height */}
           <Skeleton className="h-4 w-1/3 rounded" /> {/* Adjusted height */}
        </CardContent>
      </Card>
    ))}
  </div>
);

const ListSkeleton = () => (
    <div className="flex flex-col gap-4 p-4">
        {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="animate-pulse flex flex-row items-center gap-4 p-4">
                {/* Larger rectangular skeleton for image */}
                <Skeleton className="h-24 w-24 rounded-md flex-shrink-0" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-6 w-1/2 rounded" /> {/* Adjusted height */}
                    {/* Removed company skeleton */}
                    <div className="flex gap-4 pt-1">
                        <Skeleton className="h-4 w-1/4 rounded" /> {/* Adjusted height */}
                        <Skeleton className="h-4 w-1/4 rounded" /> {/* Adjusted height */}
                        <Skeleton className="h-4 w-1/4 rounded" /> {/* Adjusted height */}
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
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" // Added xl breakpoint
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

        {/* Rectangular Image Area */}
        <div className="w-full aspect-video relative overflow-hidden bg-muted rounded-t-md">
            {product.imageUrl ? (
                <Image
                    src={product.imageUrl}
                    alt={product.name || "Product Image"}
                    fill // Use fill to cover the container
                    className="object-cover" // Cover the area
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw" // Responsive sizes
                />
            ) : (
                 <div className="absolute inset-0 flex items-center justify-center">
                     <Package className="h-1/3 w-1/3 text-muted-foreground opacity-50" />
                 </div>
            )}
        </div>

        {/* Content below image */}
        <CardHeader className="flex flex-row items-center gap-2 pb-2 pt-4 px-4">
            <div className="flex-1 space-y-1 overflow-hidden">
                {/* Increased title size */}
                <CardTitle className="text-lg font-semibold truncate">{product.name || "Unnamed Product"}</CardTitle>
                {/* Removed company display */}
            </div>
        </CardHeader>
        {/* Increased content text size */}
        <CardContent className="text-sm space-y-1 pt-0 flex-grow px-4 pb-4"> {/* Allow content to grow */}
            <p>Cost: Rs. {product.costPrice.toFixed(2)}</p>
            <p>Selling: Rs. {product.sellingPrice.toFixed(2)}</p>
            {(product.maxDiscount ?? 0) > 0 && (
                 // Kept badge size small for contrast
                <Badge variant="secondary" className="text-xs font-medium mt-1">
                    Up to {product.maxDiscount}% off
                </Badge>
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
        <div className="h-24 w-24 flex-shrink-0 border rounded-md overflow-hidden relative bg-muted">
             {product.imageUrl ? (
                 <Image
                     src={product.imageUrl}
                     alt={product.name || "Product Image"}
                     fill
                     className="object-cover"
                     sizes="96px" // Fixed size for list view image
                 />
             ) : (
                 <div className="absolute inset-0 flex items-center justify-center">
                     <Package className="h-10 w-10 text-muted-foreground opacity-50" />
                 </div>
             )}
        </div>

        <div className="flex-1 space-y-1 overflow-hidden">
            {/* Increased title size */}
            <CardTitle className="text-xl font-semibold truncate">{product.name || "Unnamed Product"}</CardTitle>
             {/* Removed company display */}
            {/* Increased price/discount text size */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-base pt-1 text-muted-foreground">
                <span>Cost: Rs. {product.costPrice.toFixed(2)}</span>
                <span>Selling: Rs. {product.sellingPrice.toFixed(2)}</span>
                {(product.maxDiscount ?? 0) > 0 && (
                     /* Increased badge size slightly */
                     <Badge variant="secondary" className="text-sm font-medium">
                        Max Disc: {product.maxDiscount}%
                    </Badge>
                )}
            </div>
        </div>
     </Card>
);
