
"use client";

import { useState, useEffect, useRef } from 'react'; // Import useRef
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  writeBatch,
  doc,
  getDoc,
  where,
  limit,
  serverTimestamp,
  deleteDoc, // Import deleteDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import type { Product, AddProductFormData, Company } from '@/lib/types'; // Import Company type
import { useToast } from '@/hooks/use-toast';
import { useCompanies } from './use-companies'; // Import the new hook

const PRODUCTS_COLLECTION = 'products';
const COMPANIES_COLLECTION = 'companies';
const INVENTORY_QUERY_KEY = 'inventory';
const COMPANIES_QUERY_KEY = 'companies';
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
  const { addCompany } = useCompanies(); // Use the company hook
  const [searchTerm, setSearchTerm] = useState('');
  const [offlineQueue, setOfflineQueue] = useState<OfflineProduct[]>([]);
  const isSyncing = useRef(false); // Ref to prevent concurrent syncs

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
   const { data: products = [], isLoading: isLoadingProducts, error } = useQuery<Product[]>({
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
    staleTime: 1000 * 60 * 5, // Stale after 5 mins, but rely on snapshot for updates
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
        let updatedProductsMap = new Map(oldData.map(p => [p.id, p]));
        let tempIdsSynced: string[] = []; // Track temp IDs that are now confirmed online

        snapshot.docChanges().forEach((change) => {
          const changeData = {
            id: change.doc.id,
            ...(change.doc.data() as Omit<Product, 'id' | 'createdAt'>),
            createdAt: (change.doc.data().createdAt as Timestamp).toDate(),
            isOffline: false // Mark as online when received from snapshot
          };

          // Check if this incoming document corresponds to a recently synced offline item
          const syncedOfflineItem = offlineQueue.find(op =>
                op.name === changeData.name &&
                op.costPrice === changeData.costPrice &&
                op.sellingPrice === changeData.sellingPrice &&
                op.company === changeData.company &&
                 // Check creation time within a small window (e.g., 10 seconds)
                Math.abs(op.createdAt.getTime() - changeData.createdAt.getTime()) < 10000
            );


          if (change.type === "added") {
             console.log(`Adding product from snapshot: ${changeData.id}`);
             updatedProductsMap.set(changeData.id, changeData);
              if (syncedOfflineItem) {
                  console.log(`Snapshot 'added' matches offline item (Temp ID: ${syncedOfflineItem.tempId}). Removing optimistic UI entry.`);
                  updatedProductsMap.delete(syncedOfflineItem.tempId); // Remove the temporary optimistic entry
                  tempIdsSynced.push(syncedOfflineItem.tempId); // Mark tempId as synced
              }
          } else if (change.type === "modified") {
             console.log(`Modifying product from snapshot: ${changeData.id}`);
             updatedProductsMap.set(changeData.id, changeData);
             // Modification shouldn't usually correspond directly to an offline item add
          } else if (change.type === "removed") {
            console.log("Removing product from snapshot:", change.doc.id);
            updatedProductsMap.delete(change.doc.id);
            // Also remove from offline queue if it happens to be there (edge case)
            setOfflineQueue(prev => prev.filter(op => op.tempId !== change.doc.id));
          }
        });

         // Filter out synced items from the offline queue *after* processing all changes
         if (tempIdsSynced.length > 0) {
            setOfflineQueue(prev => prev.filter(op => !tempIdsSynced.includes(op.tempId)));
         }


        // Convert map back to array and sort
        return Array.from(updatedProductsMap.values())
               .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      });

    }, (err) => {
      console.error("Error fetching real-time product updates:", err);
       toast({
          title: "Sync Error",
          description: "Could not get real-time product updates. Check connection.",
          variant: "destructive",
        });
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);


  // Function to sync offline queue
  const syncOfflineQueue = async () => {
     // Prevent concurrent sync runs
     if (isSyncing.current) {
        console.log("Sync skipped: Already in progress.");
        return;
     }

     const queueToSync = [...offlineQueue]; // Work on a copy

     if (queueToSync.length === 0 || !navigator.onLine) {
       console.log(`Sync skipped: ${queueToSync.length === 0 ? 'Queue empty, ' : ''}${!navigator.onLine ? 'Offline.' : ''}`);
       return;
     }

     isSyncing.current = true; // Set lock
     console.log(`Attempting to sync ${queueToSync.length} offline products...`);
     setOfflineQueue([]); // Optimistically clear the queue state

     const batch = writeBatch(db);
     const successfullySyncedTempIds = new Set<string>();
     const failedItems: OfflineProduct[] = [];
     let syncErrors = 0;

     for (const offlineProduct of queueToSync) {
       try {
         // 1. Add Company if it's new
         if (offlineProduct.company) {
            try {
                await addCompany(offlineProduct.company); // Ensure company exists
                console.log(`Company "${offlineProduct.company}" checked/added during sync.`);
            } catch (companyError) {
                console.error(`Error ensuring company "${offlineProduct.company}" exists during sync:`, companyError);
                // Proceed with product sync but log the company issue.
                toast({
                    title: "Company Sync Warning",
                    description: `Could not verify/add company "${offlineProduct.company}". Product sync will proceed.`,
                    variant: "default",
                });
            }
         }

         // 2. Handle Image Upload (if applicable)
         let imageUrl: string | null = null; // Initialize as null instead of undefined
         let imageFile: File | null = null;

         if (offlineProduct.imageFilePath && offlineProduct.imageFileName) {
             // In a web context, imageFilePath is likely a blob URL from createObjectURL
             if (offlineProduct.imageFilePath.startsWith('blob:')) {
                try {
                    const response = await fetch(offlineProduct.imageFilePath);
                    const blob = await response.blob();
                    imageFile = new File([blob], offlineProduct.imageFileName, { type: blob.type });
                    console.log(`Reconstructed image file from blob URL for temp ID ${offlineProduct.tempId}`);
                } catch (fetchError) {
                    console.error(`Error fetching blob URL for image (Temp ID: ${offlineProduct.tempId}):`, fetchError);
                    toast({
                         title: "Image Load Failed",
                         description: `Could not load image for ${offlineProduct.name || 'product'} from local URL. Synced without image.`,
                         variant: "destructive",
                     });
                }
             } else {
                 // If not a blob URL, attempt readFileFromPath (placeholder)
                 imageFile = await readFileFromPath(offlineProduct.imageFilePath);
             }


             if (imageFile) {
                  try {
                      // Use tempId in the storage path to potentially link back if needed
                      const storageRef = ref(storage, `product_images/${offlineProduct.tempId}_${offlineProduct.imageFileName}`);
                      const uploadResult = await uploadBytes(storageRef, imageFile);
                      imageUrl = await getDownloadURL(uploadResult.ref); // Assign URL if successful
                      console.log(`Image uploaded for temp ID ${offlineProduct.tempId}: ${imageUrl}`);
                      // Revoke blob URL *after* successful upload
                      if (offlineProduct.imageFilePath?.startsWith('blob:')) {
                          URL.revokeObjectURL(offlineProduct.imageFilePath);
                      }
                  } catch (uploadError) {
                      console.error(`Error uploading image for temp ID ${offlineProduct.tempId}:`, uploadError);
                      toast({
                          title: "Image Upload Failed",
                          description: `Could not upload image for ${offlineProduct.name || 'product'}. Synced without image.`,
                          variant: "destructive",
                        });
                  }
             } else {
                 console.warn(`Could not retrieve image file for temp ID ${offlineProduct.tempId}. Syncing without image.`);
             }
         }


         // 3. Prepare Product Data for Firestore
         const { imageFilePath, imageFileName, tempId, ...productData } = offlineProduct;


          // 4. Add to Batch
          const docRef = doc(collection(db, PRODUCTS_COLLECTION)); // Let Firestore generate ID
          batch.set(docRef, {
            ...productData,
             maxDiscount: productData.maxDiscount ?? 0,
             company: productData.company || null, // Ensure company is stored or null
             imageUrl: imageUrl, // Use the potentially null imageUrl
             createdAt: Timestamp.fromDate(productData.createdAt), // Use original creation time
          });
          console.log(`Adding product (Temp ID: ${tempId}, Name: ${productData.name || 'Unnamed'}) to batch.`);
          successfullySyncedTempIds.add(tempId);


       } catch (error: any) {
         syncErrors++;
         console.error(`Error preparing product (Temp ID: ${offlineProduct.tempId}) for batch sync:`, error);
         failedItems.push(offlineProduct); // Add failed item to requeue list
          toast({
              title: "Product Sync Error",
              description: `Failed to queue ${offlineProduct.name || 'Unnamed'} for sync. It will be retried later.`,
              variant: "destructive",
            });
       }
     }


     // 5. Commit Batch if there are items to sync
     if (successfullySyncedTempIds.size > 0) {
         try {
             await batch.commit();
             console.log(`Successfully committed sync batch for ${successfullySyncedTempIds.size} products.`);
             // Items were optimistically removed. The snapshot listener should handle updating the UI correctly now.
             // If any items failed *during preparation*, they are in `failedItems`.

             toast({
                  title: "Sync Complete",
                  description: `${successfullySyncedTempIds.size} products synced. ${syncErrors > 0 ? `${syncErrors} items failed and remain queued.` : ''}`,
                   variant: syncErrors > 0 ? "destructive" : "default",
               });

         } catch (error) {
           console.error('Error committing batch sync:', error);
           // If commit fails, all items in the batch need to be requeued
           const itemsToRequeue = queueToSync.filter(item => successfullySyncedTempIds.has(item.tempId));
           failedItems.push(...itemsToRequeue); // Add batch-failed items to requeue list

           toast({
             title: "Sync Commit Failed",
             description: `Could not sync ${successfullySyncedTempIds.size} products due to a batch error. They remain queued for retry.`,
             variant: "destructive",
           });
         }
      } else if (syncErrors > 0) {
         console.log("Sync attempted, but only errors occurred. Failed items requeued.");
      } else {
          console.log("Sync queue processed, nothing needed committing."); // Should ideally not happen often
      }

      // 6. Requeue any failed items
      if (failedItems.length > 0) {
          setOfflineQueue(prev => [...failedItems, ...prev]); // Add failed items back to the start of the queue
          console.log(`${failedItems.length} items failed sync and were re-added to the queue.`);
      }

      isSyncing.current = false; // Release lock
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
          description: "Changes will be synced when you reconnect.",
          variant: "default"
        });
     };

     window.addEventListener('online', handleOnline);
     window.addEventListener('offline', handleOffline);

     // Initial check and sync attempt
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
   }, [addCompany]); // Re-added addCompany dependency, ensure it's stable


  // Add product mutation (modified for background processing)
  const addProductMutation = useMutation({
     // Changed mutationFn to be synchronous for local operations only
     mutationFn: (formData: AddProductFormData) => {
       const { imageFile, company, ...productData } = {
           ...formData,
           company: formData.company?.trim() || undefined,
           maxDiscount: formData.maxDiscount ?? 0,
       };
       const tempId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
       const createdAt = new Date();
       let localImageUrl: string | undefined = undefined;
       let localImageFilePath: string | undefined = undefined;

       // Create local image URL if file exists
       if (imageFile) {
          localImageUrl = URL.createObjectURL(imageFile);
          localImageFilePath = localImageUrl; // Store the blob URL itself for potential reconstruction
       }

       // --- Local Updates ---
       const offlineProduct: OfflineProduct = {
         ...productData,
         company,
         tempId,
         imageFilePath: localImageFilePath,
         imageFileName: imageFile?.name,
         createdAt,
       };

        // 1. Optimistic UI Update (Add to list immediately)
        queryClient.setQueryData<Product[]>([INVENTORY_QUERY_KEY], (oldData = []) => [
            {
                 id: tempId, // Use temp ID
                 name: productData.name,
                 company,
                 costPrice: productData.costPrice,
                 sellingPrice: productData.sellingPrice,
                 maxDiscount: productData.maxDiscount,
                 imageUrl: localImageUrl, // Use local blob URL for immediate preview
                 createdAt,
                 isOffline: true // Mark as offline initially
             },
            ...oldData,
        ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));

       // 2. Add to Offline Queue
        setOfflineQueue((prevQueue) => [...prevQueue, offlineProduct]);
        console.log("Product added to local queue:", tempId);

       // 3. Trigger background sync (do not await)
        if (navigator.onLine) {
          syncOfflineQueue(); // Attempt sync immediately if online
        } else {
          console.log("Offline: Sync will be attempted upon reconnection.");
        }

        // 4. Ensure Company Exists (in background, do not await)
        if (company) {
            addCompany(company).catch(err => {
                console.error("Background error ensuring company exists:", err);
                // Optional: Show a non-blocking warning toast if needed later
            });
        }

        // 5. Return immediately after local updates
        return { tempId, localName: productData.name }; // Return minimal info, no network result needed here

     },
     onSuccess: (data, variables) => {
       // Toast indicates successful *local* save, sync happens separately
       toast({
          title: "Product Saved Locally",
          description: `${variables.name || 'Product'} saved. Syncing in background...`,
          variant: 'default',
          style: { backgroundColor: 'var(--accent-success)', color: 'var(--accent-success-foreground)' },
          duration: 500, // Set duration to 500ms (0.5 seconds)
        });
     },
     onError: (error, variables) => {
       console.error('Error in addProductMutation (local save):', error);
       toast({
         title: "Error Saving Product Locally",
         description: `Could not save ${variables.name || 'product'} locally. Please try again.`,
         variant: "destructive",
       });
        // Remove the optimistic UI update if the local save fails
        queryClient.setQueryData<Product[]>([INVENTORY_QUERY_KEY], (oldData = []) =>
            oldData.filter(p => !(p.id.startsWith('local_') && p.name === variables.name && p.isOffline))
                 .sort((a, b) => b.createdAt.getTime() - a.getTime())
        );
     },
  });

   // Filter products based on search term (include company in search)
    const filteredProducts = products.filter(product =>
        (product.name?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
        (product.company?.toLowerCase() ?? '').includes(searchTerm.toLowerCase())
    );


  return {
     products: filteredProducts, // Display products including optimistic updates
     isLoading: isLoadingProducts, // Use only product loading state here
    error,
    searchTerm,
    setSearchTerm,
    addProduct: addProductMutation.mutate, // Expose the synchronous mutate function
    isAddingProduct: addProductMutation.isPending, // Reflects local processing state
    syncOfflineQueue,
    offlineQueueCount: offlineQueue.length, // Keep track of pending offline items count
  };
}

    