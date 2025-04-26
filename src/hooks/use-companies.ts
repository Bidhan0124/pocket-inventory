
"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import type { Company } from '@/lib/types';

const COMPANIES_COLLECTION = 'companies';
export const COMPANIES_QUERY_KEY = 'companies';

/**
 * Hook to fetch and manage company data from Firestore.
 */
export function useCompanies() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch the list of companies using useQuery
  const { data: companies = [], isLoading, error } = useQuery<Company[]>({
    queryKey: [COMPANIES_QUERY_KEY],
    queryFn: async () => {
      console.log('Fetching companies from Firestore...');
      const companiesCollection = collection(db, COMPANIES_COLLECTION);
      // Fetching all companies, ordered by name for display
      const q = query(companiesCollection, orderBy('nameLower', 'asc'));
      const snapshot = await getDocs(q);
      const fetchedCompanies = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Company, 'id' | 'createdAt'>),
        createdAt: doc.data().createdAt instanceof Timestamp ? (doc.data().createdAt as Timestamp).toDate() : undefined,
      }));
      console.log('Fetched companies:', fetchedCompanies.length);
      return fetchedCompanies;
    },
    staleTime: 1000 * 60 * 15, // Keep data fresh for 15 minutes
    refetchOnWindowFocus: false, // Don't refetch just on window focus
  });


  // Mutation to add a new company if it doesn't exist (checks Firestore)
  const addCompanyMutation = useMutation({
    mutationFn: async (companyName: string): Promise<Company | null> => {
      const trimmedName = companyName?.trim();
      if (!trimmedName) {
        console.log("Skipping addCompany: companyName is empty or whitespace.");
        return null;
      }
      const lowerCaseName = trimmedName.toLowerCase();

      // Check Firestore directly if company already exists (case-insensitive)
      console.log(`Checking Firestore if company "${trimmedName}" exists...`);
      const companiesCollection = collection(db, COMPANIES_COLLECTION);
      const q = query(companiesCollection, where('nameLower', '==', lowerCaseName), limit(1));
      const existingSnapshot = await getDocs(q);

      if (!existingSnapshot.empty) {
        const existingDoc = existingSnapshot.docs[0];
        console.log(`Company "${trimmedName}" already exists in Firestore with ID: ${existingDoc.id}.`);
        const data = existingDoc.data() as Omit<Company, 'id' | 'createdAt'> & { createdAt?: Timestamp };
        return {
            id: existingDoc.id,
            name: data.name,
            nameLower: data.nameLower,
            createdAt: data.createdAt?.toDate()
        };
      }

      // Add new company if it doesn't exist
      console.log(`Adding new company "${trimmedName}" to Firestore`);
      const now = new Date();
      const docRef = await addDoc(companiesCollection, {
        name: trimmedName,
        nameLower: lowerCaseName,
        createdAt: Timestamp.fromDate(now),
      });
      console.log(`Successfully added company "${trimmedName}" with ID: ${docRef.id}`);

      const newCompany: Company = {
          id: docRef.id,
          name: trimmedName,
          nameLower: lowerCaseName,
          createdAt: now
      };

      return newCompany;
    },
    onSuccess: (data, variables) => {
      if (data) {
         console.log(`Company add/check successful for: ${variables}. Result ID: ${data.id}`);
         // Invalidate the query to refetch the list after a successful add/check
         queryClient.invalidateQueries({ queryKey: [COMPANIES_QUERY_KEY] });
      } else {
         console.log(`Company add/check skipped or no action needed for: ${variables}`);
      }
    },
    onError: (error, variables) => {
      console.error(`Error ensuring company "${variables}" exists:`, error);
      toast({
        title: "Error Processing Company",
        description: `Could not add or verify company "${variables}".`,
        variant: "destructive",
      });
    },
  });

  return {
    companies, // Provide the fetched list
    isLoading, // Loading state for the company list query
    error,     // Error state for the company list query
    // Provide the async mutation function. The component calling this should await it.
    addCompany: addCompanyMutation.mutateAsync,
    // Provide the pending state of the mutation.
    isAddingCompany: addCompanyMutation.isPending,
  };
}
