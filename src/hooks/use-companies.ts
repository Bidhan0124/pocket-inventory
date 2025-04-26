
"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  limit,
  Timestamp,
  serverTimestamp,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Company } from '@/lib/types';
import { useToast } from './use-toast';
import { useEffect } from 'react';

const COMPANIES_COLLECTION = 'companies';
export const COMPANIES_QUERY_KEY = 'companies';

export function useCompanies() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch companies using React Query
  const { data: companies = [], isLoading, error } = useQuery<Company[]>({
    queryKey: [COMPANIES_QUERY_KEY],
    queryFn: async () => {
      console.log('Fetching companies from Firestore...');
      const companiesCollection = collection(db, COMPANIES_COLLECTION);
      // Order by name for consistency, consider adding indexing in Firestore
      const q = query(companiesCollection, orderBy('nameLower'));
      const snapshot = await getDocs(q);
      const fetchedCompanies = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Company, 'id' | 'createdAt'>),
        createdAt: (doc.data().createdAt as Timestamp)?.toDate() ?? new Date(), // Handle potential null timestamp
      }));
      console.log('Fetched companies:', fetchedCompanies.length);
      return fetchedCompanies;
    },
    staleTime: 1000 * 60 * 15, // Companies list might not change as often, 15 mins
  });

  // Set up real-time listener for companies (optional, but good for consistency)
   useEffect(() => {
    const companiesCollection = collection(db, COMPANIES_COLLECTION);
    const q = query(companiesCollection, orderBy('nameLower')); // Match queryFn order

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log("Company snapshot received:", snapshot.docChanges().length, "changes");
      queryClient.setQueryData<Company[]>([COMPANIES_QUERY_KEY], (oldData = []) => {
          let updatedCompaniesMap = new Map(oldData.map(c => [c.id, c]));

           snapshot.docChanges().forEach((change) => {
               const changeData = {
                   id: change.doc.id,
                   ...(change.doc.data() as Omit<Company, 'id' | 'createdAt'>),
                   createdAt: (change.doc.data().createdAt as Timestamp)?.toDate() ?? new Date(),
                };

               if (change.type === "added" || change.type === "modified") {
                  console.log(`${change.type === "added" ? 'Adding' : 'Modifying'} company from snapshot:`, change.doc.id);
                  updatedCompaniesMap.set(changeData.id, changeData);
                } else if (change.type === "removed") {
                   console.log("Removing company from snapshot:", change.doc.id);
                   updatedCompaniesMap.delete(change.doc.id);
                }
           });

           // Convert map back to array and sort
           return Array.from(updatedCompaniesMap.values())
                   .sort((a, b) => a.nameLower.localeCompare(b.nameLower)); // Sort by nameLower
       });
    }, (err) => {
        console.error("Error fetching real-time company updates:", err);
        toast({
            title: "Sync Error",
            description: "Could not get real-time company updates.",
            variant: "destructive",
        });
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [queryClient]); // Dependencies: queryClient and toast


  // Mutation to add a new company if it doesn't exist
  const addCompanyMutation = useMutation({
    mutationFn: async (companyName: string): Promise<Company | null> => {
       const trimmedName = companyName.trim();
       if (!trimmedName) {
         // Reject or return null if name is empty after trimming
         console.warn("Attempted to add an empty company name.");
         return null;
       }

       const nameLower = trimmedName.toLowerCase();

      // Check if company already exists (case-insensitive)
      const companiesCollection = collection(db, COMPANIES_COLLECTION);
      const q = query(companiesCollection, where('nameLower', '==', nameLower), limit(1));
      const existingSnapshot = await getDocs(q);

      if (!existingSnapshot.empty) {
        console.log(`Company "${trimmedName}" already exists.`);
        // Return the existing company data if needed, or null to indicate no new add
        const existingDoc = existingSnapshot.docs[0];
         return {
             id: existingDoc.id,
             ...(existingDoc.data() as Omit<Company, 'id' | 'createdAt'>),
             createdAt: (existingDoc.data().createdAt as Timestamp)?.toDate() ?? new Date(),
         };
      }

      // Add new company
      console.log(`Adding new company: "${trimmedName}"`);
      const docRef = await addDoc(companiesCollection, {
        name: trimmedName,
        nameLower: nameLower,
        createdAt: serverTimestamp(), // Use server timestamp for consistency
      });
      console.log(`Company "${trimmedName}" added with ID: ${docRef.id}`);

       // Optionally fetch the newly added doc to get server timestamp immediately
       // This might be overkill if the real-time listener updates quickly
       const newDocSnap = await getDoc(docRef);
       if (newDocSnap.exists()) {
          const newCompanyData = {
              id: newDocSnap.id,
              ...(newDocSnap.data() as Omit<Company, 'id' | 'createdAt'>),
              createdAt: (newDocSnap.data().createdAt as Timestamp)?.toDate() ?? new Date(), // Handle potential delay
           };
           // Manually update the query cache if not relying solely on listener
          // queryClient.setQueryData<Company[]>([COMPANIES_QUERY_KEY], (old = []) => [...old, newCompanyData].sort((a,b) => a.nameLower.localeCompare(b.nameLower)));
          return newCompanyData;
       }

      return null; // Should ideally not happen if addDoc succeeds

    },
    onSuccess: (data, variables) => {
      // Invalidate query to refetch if not using real-time updates,
      // or rely on the real-time listener to update the cache.
      // queryClient.invalidateQueries({ queryKey: [COMPANIES_QUERY_KEY] });

       // No toast needed here, as it's an internal operation for product adding
       // console.log(`Company "${variables}" ensured existence.`);
    },
    onError: (error, variables) => {
      console.error(`Error adding company "${variables}":`, error);
      toast({
        title: 'Error Adding Company',
        description: `Could not add company "${variables}". Please try again.`,
        variant: 'destructive',
      });
    },
  });

  return {
    companies,
    isLoading,
    error,
    addCompany: addCompanyMutation.mutateAsync, // Expose the async mutation function
    isAddingCompany: addCompanyMutation.isPending,
  };
}
