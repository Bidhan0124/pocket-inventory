
"use client";

import { useState, useEffect, useRef } from 'react'; // Import useRef
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
  limit, // Keep limit for company check
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import type { Product, AddProductFormData } from '@/lib/types'; // Import AddProductFormData
import { useToast } from '@/hooks/use-toast';
import { useCompanies } from './use-companies'; // Import the *updated* useCompanies hook

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
  // Only get what's needed: addCompany mutation and its pending state.
  // Company list and loading state are handled in AddProductForm via useCompanies.
  const { addCompany, isAddingCompany } = useCompanies();
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

        snapshot.docChanges().forEach((change) => {
          const changeData = {
            id: change.doc.id,
            ...(change.doc.data() as Omit<Product, 'id' | 'createdAt'>),
            createdAt: (change.doc.data().createdAt as Timestamp).toDate(),
            isOffline: false // Mark as online when received from snapshot
          };

          if (change.type === "added" || change.type === "modified") { // Combine add/modify logic for simplicity
            console.log(`${change.type === "added" ? 'Adding' : 'Modifying'} product from snapshot:`, change.doc.id);
            updatedProductsMap.set(changeData.id, changeData);
             // Remove corresponding offline item if it exists when added/modified from Firestore
            setOfflineQueue(prev => prev.filter(op => op.tempId !== changeData.id));

          } else if (change.type === "removed") {
            console.log("Removing product from snapshot:", change.doc.id);
            updatedProductsMap.delete(change.doc.id);
             // Also remove from offline queue if it happens to be there (edge case)
            setOfflineQueue(prev => prev.filter(op => op.tempId !== change.doc.id));
          }
        });

        // Convert map back to array and sort
        return Array.from(updatedProductsMap.values())
               .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      });

       // Syncing is handled by network status changes and mount effect

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
  }, [queryClient]); // Dependencies: queryClient and toast


  // Function to sync offline queue
  const syncOfflineQueue = async () => {
     // Prevent concurrent sync runs
     if (isSyncing.current) {
        console.log("Sync skipped: Already in progress.");
        return;
     }
     if (isAddingCompany || offlineQueue.length === 0 || !navigator.onLine) {
       console.log(`Sync skipped: ${isAddingCompany ? 'Company operation pending, ' : ''}${offlineQueue.length === 0 ? 'Queue empty, ' : ''}${!navigator.onLine ? 'Offline.' : ''}`);
       return;
     }

     isSyncing.current = true; // Set flag
     console.log(`Attempting to sync ${offlineQueue.length} offline products...`);
     const batch = writeBatch(db);
     const successfullySyncedTempIds = new Set<string>();
     let syncErrors = 0;

     // Use a copy of the queue to avoid issues if state changes during async ops
     const queueToSync = [...offlineQueue];
     setOfflineQueue([]); // Optimistically clear the queue in UI

     for (const offlineProduct of queueToSync) {
       try {
          // 1. Ensure Company Exists (Await the async mutation - important for sync integrity)
          let verifiedCompanyName = offlineProduct.company;
          if (verifiedCompanyName) {
            console.log(`Ensuring company '${verifiedCompanyName}' exists during sync for temp ID ${offlineProduct.tempId}...`);
             try {
                const companyResult = await addCompany(verifiedCompanyName);
                 if (companyResult) {
                    verifiedCompanyName = companyResult.name; // Use corrected name
                    console.log(`Company '${verifiedCompanyName}' ensured/found (ID: ${companyResult.id}) during sync.`);
                 } else {
                    verifiedCompanyName = undefined; // Clear if addCompany returns null
                 }
             } catch (companySyncError) {
                 console.error(`Error ensuring company '${verifiedCompanyName}' during sync:`, companySyncError);
                 toast({
                     title: "Company Sync Error",
                     description: `Could not verify/add company '${verifiedCompanyName}' during sync. Product synced without company.`,
                     variant: "destructive",
                 });
                 verifiedCompanyName = undefined; // Clear on error
             }
          }

         // 2. Handle Image Upload (if applicable)
         let imageUrl: string | undefined = undefined;
         let imageFile: File | null = null;

         if (offlineProduct.imageFilePath && offlineProduct.imageFileName) {
            imageFile = await readFileFromPath(offlineProduct.imageFilePath);

            if (imageFile) {
                 try {
                     const storageRef = ref(storage, `product_images/${offlineProduct.tempId}_${offlineProduct.imageFileName}`);
                     const uploadResult = await uploadBytes(storageRef, imageFile);
                     imageUrl = await getDownloadURL(uploadResult.ref);
                     console.log(`Image uploaded for temp ID ${offlineProduct.tempId}: ${imageUrl}`);
                     if (offlineProduct.imageFilePath.startsWith('blob:')) {
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
                console.warn(`Could not retrieve image file from path for temp ID ${offlineProduct.tempId}. Syncing without image.`);
            }
         }


         // 3. Prepare Product Data for Firestore
         const { imageFilePath, imageFileName, tempId, company, ...productData } = offlineProduct;


          // 4. Add to Batch
          const docRef = doc(collection(db, PRODUCTS_COLLECTION));
          batch.set(docRef, {
            ...productData,
             maxDiscount: productData.maxDiscount ?? 0,
             company: verifiedCompanyName || null, // Use the verified name
             imageUrl,
             createdAt: Timestamp.fromDate(productData.createdAt),
          });
          console.log(`Adding product (Temp ID: ${tempId}, Name: ${productData.name || 'Unnamed'}) to batch.`);
          successfullySyncedTempIds.add(tempId);


       } catch (error: any) {
         syncErrors++;
         console.error(`Error preparing product (Temp ID: ${offlineProduct.tempId}) for batch sync:`, error);
          toast({
              title: "Product Sync Error",
              description: `Failed to sync product: ${offlineProduct.name || 'Unnamed'}. It will be retried later.`, // Adjusted message
              variant: "destructive",
            });
           // Add the failed item back to the queue
           setOfflineQueue(prev => [...prev, offlineProduct]);
       }
     }


     // 5. Commit Batch if there are items to sync
     if (successfullySyncedTempIds.size > 0) {
         try {
             await batch.commit();
             console.log(`Successfully committed sync for ${successfullySyncedTempIds.size} products.`);

             // Items were already optimistically removed, no state update needed here if commit succeeds
             // If commit fails, items that failed individually were already added back

              toast({
                  title: "Sync Complete",
                  description: `${successfullySyncedTempIds.size} products synced. ${syncErrors > 0 ? `${syncErrors} errors occurred.` : ''}`,
                   variant: syncErrors > 0 ? "destructive" : "default",
               });

             // Real-time listener handles product list updates

         } catch (error) {
           console.error('Error committing batch sync:', error);
           // Add back items that were supposed to be synced but failed at commit
           const itemsToRequeue = queueToSync.filter(item => successfullySyncedTempIds.has(item.tempId));
           setOfflineQueue(prev => [...prev, ...itemsToRequeue]);

           toast({
             title: "Sync Commit Failed",
             description: `Could not commit ${successfullySyncedTempIds.size} synced products. They remain queued for retry.`,
             variant: "destructive",
           });
         }
      } else if (syncErrors > 0) {
         console.log("Sync attempted, but only errors occurred. Failed items requeued.");
      } else {
          console.log("Sync queue processed, nothing to commit."); // This case might happen due to optimistic clearing
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
   }, [addCompany]); // Add addCompany as dependency for syncOfflineQueue


  // Add product mutation
  const addProductMutation = useMutation({
     mutationFn: async (formData: AddProductFormData) => {
       const { imageFile, ...productData } = {
           ...formData,
           maxDiscount: formData.maxDiscount ?? 0,
           // Company name is already processed and confirmed in the form's onSubmit
           company: formData.company || undefined,
       };
       const tempId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
       const createdAt = new Date();
       let localImageUrl: string | undefined = undefined;
       let localImageFilePath: string | undefined = undefined;

       // Company check/add is now handled *before* this mutation is called (in AddProductForm onSubmit)
       const finalCompanyName = productData.company; // Use the name passed from the form


       // --- Image Handling ---
       if (imageFile) {
          localImageUrl = URL.createObjectURL(imageFile);
          localImageFilePath = localImageUrl;
       }
       // --- End Image Handling ---

       const offlineProduct: OfflineProduct = {
         ...productData,
         company: finalCompanyName, // Use the confirmed company name
         tempId,
         imageFilePath: localImageFilePath,
         imageFileName: imageFile?.name,
         createdAt,
       };

        // 1. Optimistic UI Update (Add to list immediately)
        queryClient.setQueryData<Product[]>([INVENTORY_QUERY_KEY], (oldData = []) => [
            {
                 id: tempId,
                 name: productData.name,
                 company: finalCompanyName,
                 costPrice: productData.costPrice,
                 sellingPrice: productData.sellingPrice,
                 maxDiscount: productData.maxDiscount,
                 imageUrl: localImageUrl,
                 createdAt,
                 isOffline: true // Mark as offline initially
             },
            ...oldData,
        ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));


       // 2. Attempt direct Firestore add if online
       if (navigator.onLine) {
         try {
           let uploadedImageUrl: string | undefined = undefined;
           if (imageFile) {
             console.log("Uploading image for new product...");
             const storageRef = ref(storage, `product_images/${tempId}_${imageFile.name}`);
             const uploadResult = await uploadBytes(storageRef, imageFile);
             uploadedImageUrl = await getDownloadURL(uploadResult.ref);
             console.log("Image uploaded:", uploadedImageUrl);
             if (localImageUrl) URL.revokeObjectURL(localImageUrl);
           }

           const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), {
             ...productData,
             company: finalCompanyName || null, // Use final name, store null if undefined
             imageUrl: uploadedImageUrl,
             createdAt: Timestamp.fromDate(createdAt),
           });
           console.log("Product added directly to Firestore with ID:", docRef.id);

           // No need to add to offline queue if direct add succeeds

           // Update optimistic item with real ID and mark as online
           queryClient.setQueryData<Product[]>([INVENTORY_QUERY_KEY], (oldData = []) =>
               oldData.map(p => p.id === tempId ? {
                   ...p,
                   id: docRef.id,
                   imageUrl: uploadedImageUrl,
                   isOffline: false // Mark as online
                } : p)
                  .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
           );

            return {
                id: docRef.id,
                name: productData.name,
                company: finalCompanyName,
                costPrice: productData.costPrice,
                sellingPrice: productData.sellingPrice,
                maxDiscount: productData.maxDiscount,
                imageUrl: uploadedImageUrl,
                createdAt
            };

         } catch (error) {
           console.error('Direct Firestore add failed, adding to offline queue:', error);
           // Add to offline queue only if direct add fails
           setOfflineQueue((prevQueue) => [...prevQueue, offlineProduct]);
           toast({
             title: "Save Error",
             description: "Saved locally. Will sync later.",
             variant: "destructive",
           });
           return undefined; // Indicate failure or offline save
         }

       } else {
         console.log("Offline: Product added to local queue.");
         // Add to offline queue if offline
         setOfflineQueue((prevQueue) => [...prevQueue, offlineProduct]);
         toast({
           title: "Saved Locally",
           description: "You are offline. Product saved locally.",
           variant: "default",
           style: { backgroundColor: 'var(--accent-success)', color: 'var(--accent-success-foreground)' }
         });
         return undefined; // Indicate offline save
       }
     },
     onSuccess: (data, variables) => {
       if (data) { // Direct online add was successful
          toast({
             title: "Product Added",
             description: `${variables.name || 'Product'} added and synced.`,
             variant: 'default',
             style: { backgroundColor: 'var(--accent-success)', color: 'var(--accent-success-foreground)' }
           });
       }
       // Offline/failed save messages are handled within mutationFn
     },
     onError: (error, variables) => {
       console.error('Error in addProductMutation:', error);
       toast({
         title: "Error Adding Product",
         description: `Could not add ${variables.name || 'product'}. Please try again.`, // General error
         variant: "destructive",
       });
        // Remove the optimistic UI update if the mutation fails fundamentally
        queryClient.setQueryData<Product[]>([INVENTORY_QUERY_KEY], (oldData = []) =>
            oldData.filter(p => !(p.id.startsWith('local_') && p.name === variables.name && p.isOffline)) // Be specific removing
                 .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        );
     },
  });

   // Filter products based on search term
    const filteredProducts = products.filter(product =>
        (product.name?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
        (product.company?.toLowerCase() ?? '').includes(searchTerm.toLowerCase())
    );


  return {
     products: filteredProducts, // Display products directly from the query cache
     isLoading: isLoadingProducts, // Use only product loading state here
    error,
    searchTerm,
    setSearchTerm,
    addProduct: addProductMutation.mutate,
    isAddingProduct: addProductMutation.isPending || isAddingCompany, // Reflect product adding OR company check/add pending state
    syncOfflineQueue,
    offlineQueueCount: offlineQueue.length, // Keep track of pending offline items count
  };
}
