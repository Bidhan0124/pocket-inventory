
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
  onSnapshot // Keep onSnapshot import if real-time updates for the list are desired in the future
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import type { Company } from '@/lib/types';
import { useEffect } from 'react'; // Keep useEffect for potential future listener

const COMPANIES_COLLECTION = 'companies';
export const COMPANIES_QUERY_KEY = 'companies';

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

  // Optional: Set up real-time listener if needed in the future
  // useEffect(() => {
  //   const companiesCollection = collection(db, COMPANIES_COLLECTION);
  //   const q = query(companiesCollection, orderBy('nameLower', 'asc'));
  //   const unsubscribe = onSnapshot(q, (snapshot) => {
  //     console.log("Company snapshot received:", snapshot.docChanges().length, "changes");
  //     queryClient.setQueryData<Company[]>([COMPANIES_QUERY_KEY], (oldData = []) => {
  //        let updatedMap = new Map(oldData.map(c => [c.id, c]));
  //        snapshot.docChanges().forEach((change) => {
  //            const changeData = {
  //              id: change.doc.id,
  //              ...(change.doc.data() as Omit<Company, 'id' | 'createdAt'>),
  //              createdAt: change.doc.data().createdAt instanceof Timestamp ? (change.doc.data().createdAt as Timestamp).toDate() : undefined,
  //            };
  //            if (change.type === "added" || change.type === "modified") {
  //                updatedMap.set(changeData.id, changeData);
  //            } else if (change.type === "removed") {
  //                updatedMap.delete(change.doc.id);
  //            }
  //        });
  //        return Array.from(updatedMap.values()).sort((a, b) => a.nameLower?.localeCompare(b.nameLower ?? '') ?? 0);
  //     });
  //   }, (err) => {
  //       console.error("Error fetching real-time company updates:", err);
  //       toast({
  //         title: "Sync Error",
  //         description: "Could not get real-time company updates.",
  //         variant: "destructive",
  //       });
  //   });
  //   return () => unsubscribe();
  // }, [queryClient, toast]);

  // Mutation to add a new company if it doesn't exist
  const addCompanyMutation = useMutation({
    mutationFn: async (companyName: string): Promise<Company | null> => {
      if (!companyName?.trim()) {
        console.log("Skipping addCompany: companyName is empty or whitespace.");
        return null;
      }
      const trimmedName = companyName.trim();
      const lowerCaseName = trimmedName.toLowerCase();

      // Check if company already exists (case-insensitive) in the cached data first
      const existingCompany = companies.find(c => c.nameLower === lowerCaseName);
      if (existingCompany) {
          console.log(`Company "${trimmedName}" already exists locally with ID: ${existingCompany.id}.`);
          return existingCompany;
      }

      // If not found locally, double-check in Firestore
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

      // Add new company
      console.log(`Adding new company "${trimmedName}" to Firestore`);
      const now = new Date();
      const docRef = await addDoc(companiesCollection, {
        name: trimmedName,
        nameLower: lowerCaseName,
        createdAt: Timestamp.fromDate(now),
      });
      console.log(`Successfully added company "${trimmedName}" with ID: ${docRef.id}`);

      const newCompany = {
          id: docRef.id,
          name: trimmedName,
          nameLower: lowerCaseName,
          createdAt: now
      };

      // Optimistically update the local cache
      queryClient.setQueryData<Company[]>([COMPANIES_QUERY_KEY], (oldData = []) =>
            [...oldData, newCompany].sort((a, b) => a.nameLower?.localeCompare(b.nameLower ?? '') ?? 0)
      );

      return newCompany;
    },
    onSuccess: (data, variables) => {
      if (data) {
         console.log(`Company add/check successful for: ${variables}. Result ID: ${data.id}`);
         // Invalidate only if not using real-time listener, to ensure fresh data eventually
         // queryClient.invalidateQueries({ queryKey: [COMPANIES_QUERY_KEY] });
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
    addCompany: addCompanyMutation.mutateAsync,
    isAddingCompany: addCompanyMutation.isPending,
  };
}
