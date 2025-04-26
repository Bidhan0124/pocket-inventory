
"use client";

import { useState } from 'react';
import type { ViewMode } from '@/lib/types'; // Import the ViewMode type
import { useInventory } from "@/hooks/use-inventory";
import { AddProductForm } from "@/components/add-product-form";
import { ProductList } from "@/components/product-list";
import { SearchBar } from "@/components/search-bar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";


export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid'); // State for view mode
  const {
    products,
    isLoading,
    error,
    searchTerm,
    setSearchTerm,
    addProduct,
    isAddingProduct,
    offlineQueueCount,
  } = useInventory();

  // Basic error display
  if (error) {
    return (
       <div className="flex items-center justify-center min-h-screen">
         <Alert variant="destructive" className="max-w-md">
           <Terminal className="h-4 w-4" />
           <AlertTitle>Error Loading Inventory</AlertTitle>
           <AlertDescription>
             Could not fetch product data. Please check your connection and try again.
             {/* {error.message} */}
           </AlertDescription>
         </Alert>
       </div>
     );
  }

  return (
    <div className="flex flex-col min-h-screen">
       <SearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          offlineQueueCount={offlineQueueCount}
          viewMode={viewMode} // Pass view mode
          onViewChange={setViewMode} // Pass setter function
          searchPlaceholder="Search products by name or company..." // Updated placeholder
        />
      <main className="flex-1 pb-24"> {/* Add padding-bottom to avoid overlap with FAB */}

        <ProductList products={products} isLoading={isLoading} viewMode={viewMode} /> {/* Pass view mode */}
      </main>
      <AddProductForm onAddProduct={addProduct} isAdding={isAddingProduct} />
    </div>
  );
}

