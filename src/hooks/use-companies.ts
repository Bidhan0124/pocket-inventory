
"use client";

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
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import type { Company } from '@/lib/types';
import { useEffect } from 'react';

const COMPANIES_COLLECTION = 'companies';
export const COMPANIES_QUERY_KEY = 'companies';

export function useCompanies() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch companies from Firestore using React Query and subscribe to real-time updates
  const { data: companies = [], isLoading, error } = useQuery<Company[]>({
    queryKey: [COMPANIES_QUERY_KEY],
    queryFn: async () => {
      console.log('Fetching companies from Firestore...');
      const companiesCollection = collection(db, COMPANIES_COLLECTION);
      const q = query(companiesCollection, orderBy('name', 'asc')); // Order alphabetically
      const snapshot = await getDocs(q);
      const fetchedCompanies = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Company, 'id'>),
      }));
      console.log('Fetched companies:', fetchedCompanies.length);
      return fetchedCompanies;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes, refetch periodically or rely on snapshot
    refetchOnWindowFocus: true,
  });

   // Set up real-time listener for companies
   useEffect(() => {
    const companiesCollection = collection(db, COMPANIES_COLLECTION);
    const q = query(companiesCollection, orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log("Companies snapshot received:", snapshot.docChanges().length, "changes");
      const updatedCompanies = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Company, 'id'>),
      }));
       // Update the query cache with the latest data
       queryClient.setQueryData<Company[]>([COMPANIES_QUERY_KEY], updatedCompanies);

    }, (err) => {
      console.error("Error fetching real-time company updates:", err);
       toast({
          title: "Company Sync Error",
          description: "Could not get real-time company updates.",
          variant: "destructive",
        });
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [queryClient, toast]);


  // Mutation to add a new company if it doesn't exist
  const addCompanyMutation = useMutation({
    mutationFn: async (companyName: string) => {
      if (!companyName?.trim()) {
        // Don't add empty or whitespace-only names
        return null;
      }
      const trimmedName = companyName.trim();

      // Check if company already exists (case-insensitive)
      const companiesCollection = collection(db, COMPANIES_COLLECTION);
      const q = query(companiesCollection, where('nameLower', '==', trimmedName.toLowerCase()), limit(1));
      const existingSnapshot = await getDocs(q);

      if (!existingSnapshot.empty) {
        console.log(`Company "${trimmedName}" already exists.`);
        return existingSnapshot.docs[0].data() as Company; // Return existing company
      }

      // Add new company
      console.log(`Adding new company "${trimmedName}"`);
      const docRef = await addDoc(companiesCollection, {
        name: trimmedName,
        nameLower: trimmedName.toLowerCase(), // Store lowercase for efficient querying
        createdAt: Timestamp.now(),
      });
      return { id: docRef.id, name: trimmedName };
    },
    onSuccess: (data, variables) => {
      if (data) {
         console.log(`Company add success/check complete for: ${variables}`);
         // Invalidate query to refetch, although snapshot listener should handle it too
         // queryClient.invalidateQueries({ queryKey: [COMPANIES_QUERY_KEY] });
      }
    },
    onError: (error, variables) => {
      console.error(`Error adding company "${variables}":`, error);
      toast({
        title: "Error Adding Company",
        description: `Could not add company "${variables}".`,
        variant: "destructive",
      });
    },
  });

  return {
    companies,
    isLoading,
    error,
    addCompany: addCompanyMutation.mutateAsync, // Expose mutateAsync for potential chaining/awaiting
  };
}
