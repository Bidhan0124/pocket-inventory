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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import type { Product } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

const PRODUCTS_COLLECTION = 'products';
const INVENTORY_QUERY_KEY = 'inventory';
const LOCAL_STORAGE_KEY = 'pocketInventory_local';

interface OfflineProduct extends Omit<Product, 'id' | 'createdAt' | 'imageUrl'> {
  tempId: string;
  imageFile?: File;
  createdAt: Date; // Ensure createdAt is Date type locally
}

export function useInventory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [offlineQueue, setOfflineQueue] = useState<OfflineProduct[]>([]);

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

  // Set up real-time listener
  useEffect(() => {
    const productsCollection = collection(db, PRODUCTS_COLLECTION);
    const q = query(productsCollection, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log("Firestore snapshot received:", snapshot.docChanges().length, "changes");
      const updatedProducts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Product, 'id' | 'createdAt'>),
        createdAt: (doc.data().createdAt as Timestamp).toDate(),
      }));
      queryClient.setQueryData<Product[]>([INVENTORY_QUERY_KEY], (oldData) => {
        // Basic merge strategy: replace entire list with the latest snapshot
        // More sophisticated merging could be done if needed (e.g., handling local edits)
        return updatedProducts;
      });
    }, (err) => {
      console.error("Error fetching real-time updates:", err);
       toast({
          title: "Sync Error",
          description: "Could not get real-time updates. Please check your connection.",
          variant: "destructive",
        });
    });

    // Attempt to sync offline queue when online status changes or initially
    syncOfflineQueue();


    // Cleanup listener on unmount
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]); // Add syncOfflineQueue to dependencies if needed, being careful of loops


  // Function to sync offline queue
  const syncOfflineQueue = async () => {
     if (offlineQueue.length === 0 || !navigator.onLine) {
       console.log("Sync skipped: Queue empty or offline.");
       return;
     }

     console.log(`Attempting to sync ${offlineQueue.length} offline products...`);
     const batch = writeBatch(db);
     const successfullySyncedTempIds = new Set<string>();
     let uploadPromises: Promise<void>[] = [];


     for (const offlineProduct of offlineQueue) {
       try {
         let imageUrl: string | undefined = undefined;
         if (offlineProduct.imageFile) {
            // Cannot upload File objects directly after JSON stringify/parse.
            // Need to handle image upload differently if true offline required.
            // For now, assume image upload happens *before* adding to queue or requires re-selection.
            console.warn("Image file handling in offline queue needs robust implementation.");
            // Placeholder: Try to upload if the file object somehow persists (unlikely with JSON stringify)
            // If the file object is lost, the image won't be uploaded.
            if (offlineProduct.imageFile instanceof File) {
                 const storageRef = ref(storage, `product_images/${offlineProduct.tempId}_${offlineProduct.imageFile.name}`);
                 const uploadResult = await uploadBytes(storageRef, offlineProduct.imageFile);
                 imageUrl = await getDownloadURL(uploadResult.ref);
            }

         }

         const { imageFile, tempId, ...productData } = offlineProduct; // Exclude tempId and imageFile

          // Check if product with this tempId was already synced by another device
         const potentialExistingDocRef = doc(db, PRODUCTS_COLLECTION, tempId); // Use tempId as potential Firestore ID
         const potentialExistingDocSnap = await getDoc(potentialExistingDocRef);

         if (!potentialExistingDocSnap.exists()) {
             const docRef = doc(collection(db, PRODUCTS_COLLECTION)); // Let Firestore generate ID
             batch.set(docRef, {
               ...productData,
               imageUrl,
               createdAt: Timestamp.fromDate(productData.createdAt), // Convert Date back to Timestamp
             });
             console.log(`Adding product (Temp ID: ${tempId}) to batch.`);
             successfullySyncedTempIds.add(tempId); // Mark for removal from queue
         } else {
             console.log(`Product with Temp ID ${tempId} already exists. Skipping.`);
              successfullySyncedTempIds.add(tempId); // Also mark for removal as it's already synced
         }

       } catch (error) {
         console.error(`Error preparing product (Temp ID: ${offlineProduct.tempId}) for batch sync:`, error);
         // Optionally: Show a specific error toast for this product
         toast({
             title: "Sync Error",
             description: `Failed to sync product: ${offlineProduct.name || 'Unnamed'}. It will be retried.`,
             variant: "destructive",
           });
         // Do not add to successfullySyncedTempIds, it will remain in the queue
       }
     }


     try {
         await batch.commit();
         console.log(`Successfully synced ${successfullySyncedTempIds.size} products.`);

         // Remove successfully synced items from the offline queue
         setOfflineQueue((prevQueue) =>
           prevQueue.filter((item) => !successfullySyncedTempIds.has(item.tempId))
         );

         if (successfullySyncedTempIds.size > 0) {
            toast({
                title: "Sync Complete",
                description: `${successfullySyncedTempIds.size} products synced successfully.`,
                variant: "default", // Use default or success style
             });
             // No manual invalidation needed due to real-time listener
         }

     } catch (error) {
       console.error('Error committing batch sync:', error);
       toast({
         title: "Sync Failed",
         description: "Could not sync some products. They will be retried later.",
         variant: "destructive",
       });
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
       // Optionally notify user they are offline
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
   }, [offlineQueue]); // Re-run if offlineQueue changes, maybe needed if sync fails and queue persists


  // Add product mutation
  const addProductMutation = useMutation({
     mutationFn: async (newProductData: Omit<Product, 'id' | 'createdAt' | 'imageUrl'> & { imageFile?: File }) => {
      const { imageFile, ...productData } = newProductData;
      const tempId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`; // Unique temporary ID
      const createdAt = new Date(); // Use current date/time

       const offlineProduct: OfflineProduct = {
         ...productData,
         tempId,
         imageFile, // Store file reference if present (note limitations with stringify)
         createdAt,
       };

       // 1. Add to local state immediately for UI update (optimistic update)
        setOfflineQueue((prevQueue) => [...prevQueue, offlineProduct]);
         // Optimistically add to the main products list (optional, depends on desired UX)
         queryClient.setQueryData<Product[]>([INVENTORY_QUERY_KEY], (oldData = []) => [
             { ...productData, id: tempId, imageUrl: undefined, createdAt }, // Show basic data locally
             ...oldData,
         ]);


      // 2. Attempt direct Firestore add if online
      if (navigator.onLine) {
        try {
          let imageUrl: string | undefined = undefined;
          if (imageFile) {
            console.log("Uploading image...");
            const storageRef = ref(storage, `product_images/${tempId}_${imageFile.name}`);
            const uploadResult = await uploadBytes(storageRef, imageFile);
            imageUrl = await getDownloadURL(uploadResult.ref);
            console.log("Image uploaded:", imageUrl);
          }

           // Use Firestore's addDoc to get an auto-generated ID
           const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), {
             ...productData,
             imageUrl,
             createdAt: Timestamp.fromDate(createdAt), // Store as Timestamp
           });
           console.log("Product added directly to Firestore with ID:", docRef.id);


          // Remove from offline queue if direct add succeeds
            setOfflineQueue((prevQueue) => prevQueue.filter(item => item.tempId !== tempId));
             // No manual invalidation needed due to real-time listener

            return { ...productData, id: docRef.id, imageUrl, createdAt }; // Return the synced product

        } catch (error) {
          console.error('Direct Firestore add failed, keeping in offline queue:', error);
           toast({
             title: "Network Issue",
             description: "Could not save directly. Saved locally and will sync later.",
             variant: "destructive",
           });
          // No need to do anything else, it's already in the offline queue
           return undefined; // Indicate direct add failed
        }

      } else {
        console.log("Offline: Product added to local queue.");
         toast({
             title: "Saved Locally",
             description: "You are offline. Product saved locally and will sync when online.",
             variant: "default", // Green accent color in theme
           });
         return undefined; // Indicate it was added offline
      }
    },
     onSuccess: (data, variables) => {
        // This onSuccess runs AFTER the mutationFn completes.
        // If it was an online add (data is defined), the real-time listener
        // should update the cache. If it was offline (data is undefined),
        // the optimistic update already added it visually.
       if (data) { // Only show success toast if added directly online
          toast({
             title: "Product Added",
             description: `${variables.name || 'Product'} successfully added and synced.`,
              variant: 'default', // Use default or success style
             style: { backgroundColor: 'var(--accent-success)', color: 'var(--accent-success-foreground)' } // Custom success style
           });
       }
        // No need to invalidate here because of the real-time listener and offline queue handling
     },
     onError: (error, variables) => {
       console.error('Error in addProductMutation:', error);
       toast({
         title: "Error Adding Product",
         description: `Could not add ${variables.name || 'product'}. Please try again.`,
         variant: "destructive",
       });
        // Rollback optimistic update if needed (more complex state management)
        // For simplicity, the item might remain visually until next sync/refresh fails
        // Or remove from the visual list if the error is persistent
         queryClient.setQueryData<Product[]>([INVENTORY_QUERY_KEY], (oldData = []) =>
           oldData.filter((p) => p.id !== variables.tempId) // Assuming tempId was used in optimistic update
         );
     },
  });


  // Filter products based on search term
  const filteredProducts = products.filter(product =>
    (product.name?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
    (product.company?.toLowerCase() ?? '').includes(searchTerm.toLowerCase())
  );

   // Include offline items in the displayed list (optional, based on UX preference)
   const combinedList = [
     ...offlineQueue.map(op => ({ // Map offline items to Product-like structure for display
       id: op.tempId,
       name: op.name,
       company: op.company,
       costPrice: op.costPrice,
       sellingPrice: op.sellingPrice,
       maxDiscount: op.maxDiscount,
       imageUrl: op.imageFile ? URL.createObjectURL(op.imageFile) : undefined, // Temporary URL for local display
       createdAt: op.createdAt,
       isOffline: true // Flag to indicate it's not synced yet
     })),
     ...products.filter(p => !offlineQueue.some(op => op.tempId === p.id)) // Filter out synced items that might still be visually duplicated from optimistic add
   ]
   .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) // Sort combined list by creation date
   .filter(product =>
     (product.name?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
     (product.company?.toLowerCase() ?? '').includes(searchTerm.toLowerCase())
   );


  return {
    products: combinedList, // Display combined list
    // products: filteredProducts, // Or display only synced & filtered products
    isLoading,
    error,
    searchTerm,
    setSearchTerm,
    addProduct: addProductMutation.mutate,
    isAddingProduct: addProductMutation.isPending,
    syncOfflineQueue, // Expose sync function if manual trigger is needed
    offlineQueueCount: offlineQueue.length, // Expose count for UI indication
  };
}
