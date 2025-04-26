
"use client";

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  // Removed onSnapshot as real-time updates for the list are not needed now
  Timestamp,
  // Removed writeBatch, doc, getDoc as they are not used here
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import type { Company } from '@/lib/types';
// Removed useEffect as the real-time listener is removed

const COMPANIES_COLLECTION = 'companies';
export const COMPANIES_QUERY_KEY = 'companies'; // Keep key for potential future use or invalidation

export function useCompanies() {
  const queryClient = useQueryClient(); // Keep for potential invalidation if needed elsewhere
  const { toast } = useToast();

  // Remove the useQuery for fetching the list of companies as it's no longer displayed directly

  // Remove the useEffect for the real-time listener

  // Mutation to add a new company if it doesn't exist (this logic remains crucial)
  const addCompanyMutation = useMutation({
    mutationFn: async (companyName: string): Promise<Company | null> => { // Ensure return type consistency
      if (!companyName?.trim()) {
        // Don't add empty or whitespace-only names
        console.log("Skipping addCompany: companyName is empty or whitespace.");
        return null;
      }
      const trimmedName = companyName.trim();
      const lowerCaseName = trimmedName.toLowerCase();

      // Check if company already exists (case-insensitive)
      console.log(`Checking if company "${trimmedName}" exists...`);
      const companiesCollection = collection(db, COMPANIES_COLLECTION);
      const q = query(companiesCollection, where('nameLower', '==', lowerCaseName), limit(1));
      const existingSnapshot = await getDocs(q);

      if (!existingSnapshot.empty) {
        const existingDoc = existingSnapshot.docs[0];
        console.log(`Company "${trimmedName}" already exists with ID: ${existingDoc.id}.`);
        // Return the existing company data, converting timestamp if needed
        const data = existingDoc.data() as Omit<Company, 'id' | 'createdAt'> & { createdAt?: Timestamp };
        return {
            id: existingDoc.id,
            name: data.name,
            nameLower: data.nameLower,
            createdAt: data.createdAt?.toDate() // Convert timestamp to Date if it exists
        };
      }

      // Add new company
      console.log(`Adding new company "${trimmedName}"`);
      const docRef = await addDoc(companiesCollection, {
        name: trimmedName,
        nameLower: lowerCaseName, // Store lowercase for efficient querying
        createdAt: Timestamp.now(),
      });
      console.log(`Successfully added company "${trimmedName}" with ID: ${docRef.id}`);
      // Return the newly created company data
      return {
          id: docRef.id,
          name: trimmedName,
          nameLower: lowerCaseName,
          createdAt: new Date() // Use current date as createdAt
      };
    },
    onSuccess: (data, variables) => {
      if (data) {
         console.log(`Company add/check successful for: ${variables}. Result ID: ${data.id}`);
         // Optionally invalidate if other parts of the app *do* display the company list
         // queryClient.invalidateQueries({ queryKey: [COMPANIES_QUERY_KEY] });
      } else {
         console.log(`Company add/check skipped or failed for: ${variables}`);
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
    // Removed companies list, isLoading, error from return
    addCompany: addCompanyMutation.mutateAsync, // Expose mutateAsync for potential chaining/awaiting
    isAddingCompany: addCompanyMutation.isPending, // Expose pending state if needed
  };
}
