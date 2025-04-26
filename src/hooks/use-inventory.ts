
"use client";

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  writeBatch,
  doc,
  getDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import type { Product, AddProductFormData } from '@/lib/types'; // Import AddProductFormData
import { useToast } from '@/hooks/use-toast';
import { useCompanies, COMPANIES_QUERY_KEY } from './use-companies'; // Import useCompanies hook

const PRODUCTS_COLLECTION = 'products';
const INVENTORY_QUERY_KEY = 'inventory';
const LOCAL_STORAGE_KEY = 'pocketInventory_local';

interface OfflineProduct extends Omit<Product, 'id' | 'createdAt' | 'imageUrl'> {
  tempId: string;
  imageFilePath?: string; // Store path instead of file object for offline
  imageFileName?: string; // Store original filename
  createdAt: Date; // Ensure createdAt is Date type locally
}

// Helper to simulate reading a file from a path (replace with actual native file access if possible)
async function readFileFromPath(path: string): Promise<File | null> {
    // THIS IS A PLACEHOLDER - In a real mobile app, you'd use native APIs
    // For web PWA, you might store blobs in IndexedDB.
    // This simulation assumes the file is somehow accessible via the stored path.
    console.warn("readFileFromPath is a placeholder and cannot actually read files from path in web context.");
    // Try fetching if it's a blob URL? Unlikely to persist reliably.
    if (path.startsWith('blob:')) {
        try {
            const response = await fetch(path);
            const blob = await response.blob();
            // We need the original filename to create a File object
            console.error("Cannot reconstruct File object without original filename and type from blob URL.");
            return null; // Or return a Blob if that's sufficient downstream
        } catch (error) {
            console.error("Error fetching blob URL:", error);
            return null;
        }
    }
    return null;
}

export function useInventory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [offlineQueue, setOfflineQueue] = useState<OfflineProduct[]>([]);
  const { addCompany } = useCompanies(); // Get addCompany function

  // Load offline queue from local storage on mount
  useEffect(() => {
    const savedQueue = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedQueue) {
      try {
        const parsedQueue: OfflineProduct[] = JSON.parse(savedQueue).map(
          (item: any) => ({
            ...item,
            createdAt: new Date(item.createdAt), // Convert string back to Date
          })
        );
        setOfflineQueue(parsedQueue);
      } catch (error) {
        console.error("Error parsing offline queue from local storage:", error);
        localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear corrupted data
      }
    }
  }, []);

  // Save offline queue to local storage whenever it changes
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(offlineQueue));
  }, [offlineQueue]);


  // Fetch products from Firestore using React Query and subscribe to real-time updates
  const { data: products = [], isLoading, error } = useQuery<Product[]>({
    queryKey: [INVENTORY_QUERY_KEY],
    queryFn: async () => {
      console.log('Fetching products from Firestore...');
      const productsCollection = collection(db, PRODUCTS_COLLECTION);
      const q = query(productsCollection, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const fetchedProducts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Product, 'id' | 'createdAt'>),
        createdAt: (doc.data().createdAt as Timestamp).toDate(), // Convert Timestamp to Date
      }));
      console.log('Fetched products:', fetchedProducts.length);
      return fetchedProducts;
    },
    staleTime: Infinity, // Keep data fresh indefinitely, rely on real-time updates
    refetchOnMount: true, // Refetch when component mounts
    refetchOnReconnect: true, // Refetch on reconnect
  });

  // Set up real-time listener for products
  useEffect(() => {
    const productsCollection = collection(db, PRODUCTS_COLLECTION);
    const q = query(productsCollection, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log("Product snapshot received:", snapshot.docChanges().length, "changes");
       queryClient.setQueryData<Product[]>([INVENTORY_QUERY_KEY], (oldData = []) => {
          let updatedProducts = [...oldData];
          snapshot.docChanges().forEach((change) => {
              const changeData = {
                  id: change.doc.id,
                  ...(change.doc.data() as Omit<Product, 'id' | 'createdAt'>),
                   createdAt: (change.doc.data().createdAt as Timestamp).toDate(),
              };

              if (change.type === "added") {
                  // Check if it exists (from optimistic update) before adding
                   const exists = updatedProducts.some(p => p.id === change.doc.id);
                   if (!exists) {
                     console.log("Adding new product from snapshot:", change.doc.id);
                     updatedProducts.push(changeData);
                   } else {
                        // Replace potentially optimistic data with confirmed data
                        console.log("Replacing optimistic product with snapshot:", change.doc.id);
                        updatedProducts = updatedProducts.map(p => p.id === change.doc.id ? changeData : p);
                   }
               }
               if (change.type === "modified") {
                  console.log("Modifying product from snapshot:", change.doc.id);
                  updatedProducts = updatedProducts.map(p => p.id === change.doc.id ? changeData : p);
              }
              if (change.type === "removed") {
                  console.log("Removing product from snapshot:", change.doc.id);
                  updatedProducts = updatedProducts.filter(p => p.id !== change.doc.id);
              }
          });
          // Sort again after updates
           return updatedProducts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      });

       // Also attempt to sync offline queue after receiving updates
       syncOfflineQueue();

    }, (err) => {
      console.error("Error fetching real-time product updates:", err);
       toast({
          title: "Sync Error",
          description: "Could not get real-time product updates. Please check your connection.",
          variant: "destructive",
        });
    });

    // Initial attempt to sync offline queue
    syncOfflineQueue();

    // Cleanup listener on unmount
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);


  // Function to sync offline queue
  const syncOfflineQueue = async () => {
     if (offlineQueue.length === 0 || !navigator.onLine) {
       console.log("Sync skipped: Queue empty or offline.");
       return;
     }

     console.log(`Attempting to sync ${offlineQueue.length} offline products...`);
     const batch = writeBatch(db);
     const successfullySyncedTempIds = new Set<string>();
     let syncErrors = 0;

     for (const offlineProduct of offlineQueue) {
       try {
          // 1. Ensure Company Exists
          if (offlineProduct.company) {
            await addCompany(offlineProduct.company); // Ensure company exists before adding product
            // Invalidate company list after successful sync loop might be better
          }

         // 2. Handle Image Upload (if applicable)
         let imageUrl: string | undefined = undefined;
         let imageFile: File | null = null;

         if (offlineProduct.imageFilePath && offlineProduct.imageFileName) {
            // Attempt to get the File object (placeholder)
            imageFile = await readFileFromPath(offlineProduct.imageFilePath);

            if (imageFile) {
                 try {
                     const storageRef = ref(storage, `product_images/${offlineProduct.tempId}_${offlineProduct.imageFileName}`);
                     const uploadResult = await uploadBytes(storageRef, imageFile);
                     imageUrl = await getDownloadURL(uploadResult.ref);
                     console.log(`Image uploaded for temp ID ${offlineProduct.tempId}: ${imageUrl}`);
                     // Ideally, delete the local file copy after successful upload if using native storage
                 } catch (uploadError) {
                     console.error(`Error uploading image for temp ID ${offlineProduct.tempId}:`, uploadError);
                     // Decide strategy: fail sync for this item, or sync without image?
                     // Let's sync without image for now and log error
                     toast({
                         title: "Image Upload Failed",
                         description: `Could not upload image for ${offlineProduct.name || 'product'}. Product synced without image.`,
                         variant: "destructive",
                       });
                 }
            } else {
                console.warn(`Could not retrieve image file from path for temp ID ${offlineProduct.tempId}. Syncing without image.`);
            }
         }


         // 3. Prepare Product Data for Firestore
         const { imageFilePath, imageFileName, tempId, ...productData } = offlineProduct; // Exclude local-only fields

          // Check if product with this tempId was already synced (less likely with auto IDs now)
          // This check might be less necessary if we let Firestore generate IDs
          // const potentialExistingDocRef = doc(db, PRODUCTS_COLLECTION, tempId);
          // const potentialExistingDocSnap = await getDoc(potentialExistingDocRef);
          // if (!potentialExistingDocSnap.exists()) { ... }

          // 4. Add to Batch
          const docRef = doc(collection(db, PRODUCTS_COLLECTION)); // Let Firestore generate ID
          batch.set(docRef, {
            ...productData,
             // Ensure maxDiscount is a number (should be 0 if undefined in OfflineProduct)
             maxDiscount: productData.maxDiscount ?? 0,
            imageUrl, // Will be undefined if upload failed or no image
            createdAt: Timestamp.fromDate(productData.createdAt), // Convert Date back to Timestamp
          });
          console.log(`Adding product (Temp ID: ${tempId}, Name: ${productData.name || 'Unnamed'}) to batch.`);
          successfullySyncedTempIds.add(tempId); // Mark for removal from queue


       } catch (error) {
         syncErrors++;
         console.error(`Error preparing product (Temp ID: ${offlineProduct.tempId}) for batch sync:`, error);
         toast({
             title: "Sync Error",
             description: `Failed to sync product: ${offlineProduct.name || 'Unnamed'}. It will be retried.`,
             variant: "destructive",
           });
       }
     }


     // 5. Commit Batch if there are items to sync
     if (successfullySyncedTempIds.size > 0) {
         try {
             await batch.commit();
             console.log(`Successfully committed sync for ${successfullySyncedTempIds.size} products.`);

             // Remove successfully synced items from the offline queue
             setOfflineQueue((prevQueue) =>
               prevQueue.filter((item) => !successfullySyncedTempIds.has(item.tempId))
             );

              toast({
                  title: "Sync Complete",
                  description: `${successfullySyncedTempIds.size} products synced. ${syncErrors > 0 ? `${syncErrors} errors occurred.` : ''}`,
                   variant: syncErrors > 0 ? "destructive" : "default",
               });

              // Invalidate company list query *after* successful sync loop
              if (offlineQueue.some(p => p.company)) {
                  queryClient.invalidateQueries({ queryKey: [COMPANIES_QUERY_KEY] });
              }
             // No manual product invalidation needed due to real-time listener

         } catch (error) {
           console.error('Error committing batch sync:', error);
           toast({
             title: "Sync Failed",
             description: `Could not commit ${successfullySyncedTempIds.size} synced products. They remain queued for retry.`,
             variant: "destructive",
           });
         }
      } else if (syncErrors > 0) {
         console.log("Sync attempted, but only errors occurred.");
      } else {
          console.log("Sync queue processed, nothing to commit.");
      }
   };

   // Listen for online/offline events
   useEffect(() => {
     const handleOnline = () => {
       console.log("Network status: Online");
       syncOfflineQueue(); // Attempt sync when back online
     };
     const handleOffline = () => {
       console.log("Network status: Offline");
        toast({
          title: "Offline",
          description: "You are currently offline. Changes will be synced when you reconnect.",
          variant: "default"
        });
     };

     window.addEventListener('online', handleOnline);
     window.addEventListener('offline', handleOffline);

     // Initial check
     if(navigator.onLine) {
       handleOnline();
     } else {
       handleOffline();
     }

     return () => {
       window.removeEventListener('online', handleOnline);
       window.removeEventListener('offline', handleOffline);
     };
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [offlineQueue]); // Re-run if offlineQueue changes


  // Add product mutation
  const addProductMutation = useMutation({
     mutationFn: async (formData: AddProductFormData) => {
        // Ensure maxDiscount is set to 0 if it's undefined/null
       const { imageFile, ...productData } = {
           ...formData,
           maxDiscount: formData.maxDiscount ?? 0,
       };
       const tempId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
       const createdAt = new Date();
       let localImageUrl: string | undefined = undefined;
       let localImageFilePath: string | undefined = undefined;

       // --- Company Handling ---
       if (productData.company) {
           try {
               await addCompany(productData.company);
                // Invalidate company query after adding product succeeds? Or let snapshot handle it?
                // Let's rely on snapshot for now, maybe invalidate after mutation success.
           } catch (companyError) {
               console.error("Failed to ensure company exists:", companyError);
               // Decide: proceed without company, or fail? Let's proceed but log.
                toast({
                    title: "Company Check Failed",
                    description: `Could not verify/add company '${productData.company}'. Proceeding without it.`,
                    variant: "destructive",
                  });
           }
       }
       // --- End Company Handling ---


       // --- Image Handling ---
       if (imageFile) {
          // For offline: Create a temporary local URL for display and store "path" info
          localImageUrl = URL.createObjectURL(imageFile);
          // Store a placeholder path - replace with actual path if using native file system
          localImageFilePath = localImageUrl; // Using blob URL as path placeholder
       }
       // --- End Image Handling ---

       const offlineProduct: OfflineProduct = {
         ...productData,
         tempId,
         imageFilePath: localImageFilePath,
         imageFileName: imageFile?.name,
         createdAt,
       };

       // 1. Add to local state immediately for UI update (optimistic update)
       setOfflineQueue((prevQueue) => [...prevQueue, offlineProduct]);
       // Optimistically add to the main products list
       queryClient.setQueryData<Product[]>([INVENTORY_QUERY_KEY], (oldData = []) => [
            // Ensure properties match the Product type for optimistic update
           {
                id: tempId,
                name: productData.name, // Mandatory now
                company: productData.company,
                costPrice: productData.costPrice,
                sellingPrice: productData.sellingPrice,
                maxDiscount: productData.maxDiscount, // Optional, defaults to 0
                imageUrl: localImageUrl,
                createdAt,
                isOffline: true
            },
           ...oldData,
       ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())); // Keep sorted


       // 2. Attempt direct Firestore add if online
       if (navigator.onLine) {
         try {
           let uploadedImageUrl: string | undefined = undefined;
           if (imageFile) {
             console.log("Uploading image for new product...");
             // Use tempId in storage path for potential offline consistency
             const storageRef = ref(storage, `product_images/${tempId}_${imageFile.name}`);
             const uploadResult = await uploadBytes(storageRef, imageFile);
             uploadedImageUrl = await getDownloadURL(uploadResult.ref);
             console.log("Image uploaded:", uploadedImageUrl);
             // Clean up blob URL after upload if necessary
             if (localImageUrl) URL.revokeObjectURL(localImageUrl);
           }

           const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), {
             ...productData, // name, company, costPrice, sellingPrice, maxDiscount (will be 0 if omitted)
             imageUrl: uploadedImageUrl,
             createdAt: Timestamp.fromDate(createdAt),
           });
           console.log("Product added directly to Firestore with ID:", docRef.id);

           // Remove from offline queue if direct add succeeds
           setOfflineQueue((prevQueue) => prevQueue.filter(item => item.tempId !== tempId));
           // Update optimistic item with real ID and image URL (handled by snapshot listener mostly)
           // queryClient.setQueryData<Product[]>([INVENTORY_QUERY_KEY], (oldData = []) =>
           //    oldData.map(p => p.id === tempId ? { ...productData, id: docRef.id, imageUrl: uploadedImageUrl, createdAt } : p)
           //       .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
           // );

            // Return the synced product data matching the Product type
            return {
                id: docRef.id,
                name: productData.name,
                company: productData.company,
                costPrice: productData.costPrice,
                sellingPrice: productData.sellingPrice,
                maxDiscount: productData.maxDiscount,
                imageUrl: uploadedImageUrl,
                createdAt
            };

         } catch (error) {
           console.error('Direct Firestore add failed, keeping in offline queue:', error);
           toast({
             title: "Save Error",
             description: "Could not save directly to cloud. Saved locally and will sync later.",
             variant: "destructive",
           });
           // No need to do anything else, it's already in the offline queue and optimistically added
           return undefined;
         }

       } else {
         console.log("Offline: Product added to local queue.");
         toast({
           title: "Saved Locally",
           description: "You are offline. Product saved locally and will sync when online.",
           variant: "default",
           style: { backgroundColor: 'var(--accent-success)', color: 'var(--accent-success-foreground)' }
         });
         return undefined;
       }
     },
     onSuccess: (data, variables) => {
       // Runs AFTER the mutationFn completes.
       if (data) { // Direct online add was successful
          toast({
             title: "Product Added",
             description: `${variables.name || 'Product'} successfully added and synced.`,
             variant: 'default',
             style: { backgroundColor: 'var(--accent-success)', color: 'var(--accent-success-foreground)' }
           });
           // Invalidate company list *after* successful add if a company was involved
           if (variables.company) {
             queryClient.invalidateQueries({ queryKey: [COMPANIES_QUERY_KEY] });
           }
           // Snapshot listener handles UI update for products
       }
       // If offline (data is undefined), the "Saved Locally" toast was already shown.
     },
     onError: (error, variables) => {
       console.error('Error in addProductMutation:', error);
       toast({
         title: "Error Adding Product",
         description: `Could not add ${variables.name || 'product'}. It remains saved locally if offline.`,
         variant: "destructive",
       });
       // If online add failed, it should still be in offline queue for retry.
       // We might want to remove the optimistic UI update if the error is fatal?
       // For now, leave the optimistic entry, syncOfflineQueue will handle retry.
       // Example rollback:
       // queryClient.setQueryData<Product[]>([INVENTORY_QUERY_KEY], (oldData = []) =>
       //    oldData.filter((p) => p.id !== variables.tempId) // Assuming tempId was used for optimistic add
       // );
     },
  });

  // Filter/Combine Products for Display
  const combinedList = [
    // Map offline items for display
    ...offlineQueue.map(op => ({
      id: op.tempId,
      name: op.name, // Mandatory now
      company: op.company,
      costPrice: op.costPrice,
      sellingPrice: op.sellingPrice,
      maxDiscount: op.maxDiscount, // Optional, will be 0 if undefined
      // Use stored blob URL if available, otherwise undefined
      imageUrl: op.imageFilePath && op.imageFilePath.startsWith('blob:') ? op.imageFilePath : undefined,
      createdAt: op.createdAt,
      isOffline: true,
    })),
    // Add online products, filtering out any that have a corresponding offline item
    ...products.filter(p => !offlineQueue.some(op => op.tempId === p.id)),
  ]
  .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) // Sort combined list
  .filter(product => // Apply search term
    (product.name?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
    (product.company?.toLowerCase() ?? '').includes(searchTerm.toLowerCase())
  );

  return {
    products: combinedList,
    isLoading,
    error,
    searchTerm,
    setSearchTerm,
    addProduct: addProductMutation.mutate,
    isAddingProduct: addProductMutation.isPending,
    syncOfflineQueue,
    offlineQueueCount: offlineQueue.length,
  };
}

      