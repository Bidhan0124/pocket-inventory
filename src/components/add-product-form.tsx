
"use client";

import * as React from 'react';
import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Check, ChevronsUpDown, PlusCircle, Image as ImageIcon, Loader2, CheckCircle } from "lucide-react";
import { useCompanies } from '@/hooks/use-companies'; // Import hook to fetch/add companies
import type { AddProductFormData as ProductFormData } from '@/lib/types'; // Import the refined type
import { cn } from '@/lib/utils';
import Image from 'next/image'; // Use next/image for preview
import { useToast } from '@/hooks/use-toast'; // Import useToast

// Validation schema: Name is required, Max Discount is optional
export const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  company: z.string().optional(), // Selected or newly typed company name (string)
  costPrice: z.coerce.number().min(0, "Cost price must be non-negative"),
  sellingPrice: z.coerce.number().min(0, "Selling price must be non-negative"),
  maxDiscount: z.coerce.number().min(0, "Discount must be non-negative").max(100, "Discount cannot exceed 100%").optional(), // Optional, no default here, handled in submit/hook
  imageFile: z.instanceof(File).optional(),
});


interface AddProductFormProps {
  onAddProduct: (data: ProductFormData) => void;
  isAdding: boolean;
}

export function AddProductForm({ onAddProduct, isAdding }: AddProductFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [companyPopoverOpen, setCompanyPopoverOpen] = useState(false);
  // isLoading now reflects the query loading state for companies
  const { companies = [], addCompany, isAddingCompany, isLoading: isLoadingCompanies } = useCompanies();
  const { toast } = useToast(); // Get toast function


  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      company: "", // Initialize as empty string
      costPrice: 0,
      sellingPrice: 0,
      maxDiscount: undefined, // Initialize as undefined
      imageFile: undefined,
    },
  });

   const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      form.setValue("imageFile", file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
        form.setValue("imageFile", undefined);
        setImagePreview(null);
    }
  };


  const onSubmit = async (data: ProductFormData) => {
    console.log("Form submitted with data (before company check):", data);

    let finalCompanyName = data.company?.trim() || undefined; // Use the company from the form state, trim, default to undefined

     // If a company name was selected or typed, ensure it exists in the backend
     if (finalCompanyName) {
       try {
         console.log(`Ensuring company "${finalCompanyName}" exists before adding product...`);
         const companyResult = await addCompany(finalCompanyName); // Await the addition/check
         if (companyResult) {
            finalCompanyName = companyResult.name; // Use the potentially case-corrected name
            form.setValue("company", finalCompanyName); // Update form state if corrected
            console.log(`Company "${finalCompanyName}" confirmed/added.`);
         } else {
             // This might happen if addCompany filters out empty strings after trimming
             console.log(`Company "${finalCompanyName}" resulted in null/undefined after addCompany call, clearing.`);
             finalCompanyName = undefined;
         }
       } catch (error) {
         console.error(`Failed to ensure company "${finalCompanyName}" exists:`, error);
         // Optionally show an error or decide to proceed without the company
         toast({
            title: "Company Error",
            description: `Could not verify/add company "${finalCompanyName}". Product will be added without company info.`,
            variant: "destructive",
          });
          finalCompanyName = undefined; // Clear company on error
       }
     }


    const processedData: ProductFormData = {
        ...data,
        company: finalCompanyName, // Final processed company name (string or undefined)
        maxDiscount: data.maxDiscount ?? 0, // Default to 0 if undefined/null
    };
    console.log("Calling onAddProduct with processed data:", processedData);
    onAddProduct(processedData); // Pass the fully processed data
  };

   // Close dialog and reset form state
   const handleClose = () => {
      setIsOpen(false);
      form.reset({ // Reset with default values
         name: "",
         company: "",
         costPrice: 0,
         sellingPrice: 0,
         maxDiscount: undefined,
         imageFile: undefined,
      });
      setImagePreview(null);
       if(fileInputRef.current) {
          fileInputRef.current.value = '';
        }
    };

    // Reset form and close dialog after successful add attempt (regardless of actual success)
    useEffect(() => {
        // Check if the form was submitted AND the mutation is no longer pending
        if (form.formState.isSubmitted && !isAdding && !isAddingCompany) {
             // Small delay to allow success toast to show before closing
             const timer = setTimeout(() => {
                handleClose();
             }, 500); // 0.5 second delay
             return () => clearTimeout(timer); // Cleanup timeout on unmount or deps change
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdding, isAddingCompany, form.formState.isSubmitted]);


  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isAdding && !isAddingCompany && setIsOpen(open)}>
      <DialogTrigger asChild>
        <Button className="fixed bottom-6 right-6 rounded-full h-14 w-14 p-0 shadow-lg z-20 bg-gradient-to-br from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 transition-all duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
          <PlusCircle className="h-7 w-7 text-primary-foreground" />
          <span className="sr-only">Add Product</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90svh] overflow-y-auto p-6 bg-card rounded-xl shadow-2xl">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-2xl font-bold text-center text-foreground">Add New Product</DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            Fill in the details below. Fields marked <span className="text-destructive font-semibold">*</span> are required.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Image Upload Section - Rectangular Preview */}
            <div className="flex flex-col items-center gap-4">
              {/* Rectangular Preview Area */}
              <div className="w-full max-w-xs aspect-video border-2 border-border shadow-md rounded-md overflow-hidden bg-muted flex items-center justify-center">
                  {imagePreview ? (
                    <Image
                      src={imagePreview}
                      alt="Product Preview"
                      width={320} // Example width, adjust as needed
                      height={180} // Example height (16:9 aspect ratio)
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <ImageIcon className="h-10 w-10 text-muted-foreground" />
                  )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="max-w-[150px]"
                onClick={() => fileInputRef.current?.click()}
                disabled={isAdding || isAddingCompany || isLoadingCompanies}
              >
                Upload Image
              </Button>
              <FormField
                   control={form.control}
                   name="imageFile"
                   render={({ field }) => ( // No direct render needed here, just for validation
                      <FormItem className="hidden">
                         <FormControl>
                            <Input
                              type="file"
                              accept="image/*"
                              ref={fileInputRef}
                              onChange={(e) => {
                                  field.onChange(e.target.files?.[0]); // Update RHF state
                                  handleImageChange(e); // Update preview
                              }}
                              className="hidden"
                              id="product-image"
                              />
                         </FormControl>
                         <FormMessage />
                     </FormItem>
                 )}
              />
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Product Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Premium T-Shirt" {...field} className="text-base"/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Company Combobox */}
               <FormField
                control={form.control}
                name="company"
                render={({ field }) => {
                  const typedValue = field.value || ""; // Get current value from form state

                  return (
                    <FormItem className="flex flex-col">
                      <FormLabel>Company (Optional)</FormLabel>
                      {/* Use Popover for the dropdown part */}
                      <Popover open={companyPopoverOpen} onOpenChange={setCompanyPopoverOpen}>
                        <PopoverTrigger asChild>
                           <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={companyPopoverOpen}
                                className={cn(
                                  "w-full justify-between text-base",
                                  !field.value && "text-muted-foreground"
                                )}
                                disabled={isLoadingCompanies || isAdding || isAddingCompany}
                              >
                                {field.value ? field.value : "Select or type company..."}
                                {isLoadingCompanies ? (
                                  <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
                                ) : (
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                )}
                              </Button>
                           </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0">
                            {/* Use Command for the search/select functionality */}
                           <Command shouldFilter={false}> {/* Manual filtering below */}
                              <CommandInput
                                placeholder="Search or add company..."
                                value={typedValue} // Controlled input
                                onValueChange={(search) => {
                                  field.onChange(search); // Update form state as user types
                                }}
                                className="text-base h-11"
                                disabled={isLoadingCompanies || isAdding || isAddingCompany}
                              />
                              <CommandList>
                                <CommandEmpty>
                                  {typedValue.trim() && !isLoadingCompanies && (
                                    <CommandItem
                                      onSelect={() => {
                                        const newCompanyName = typedValue.trim();
                                        field.onChange(newCompanyName); // Update form state
                                        setCompanyPopoverOpen(false); // Close popover
                                      }}
                                      className="text-sm cursor-pointer"
                                    >
                                      <PlusCircle className="mr-2 h-4 w-4" />
                                      Add "{typedValue.trim()}"
                                    </CommandItem>
                                  )}
                                  {!typedValue.trim() && !isLoadingCompanies && (
                                    <span className="py-6 text-center text-sm">
                                      Type to search or add.
                                    </span>
                                  )}
                                  {isLoadingCompanies && (
                                    <span className="py-6 text-center text-sm">Loading...</span>
                                  )}
                                </CommandEmpty>
                                <CommandGroup heading="Suggestions">
                                  {companies
                                     .filter(company => company.name.toLowerCase().includes(typedValue.toLowerCase()))
                                     .map((company) => (
                                    <CommandItem
                                      value={company.name} // Important for internal CMDK state
                                      key={company.id}
                                      onSelect={() => {
                                        field.onChange(company.name); // Update form with selected company
                                        setCompanyPopoverOpen(false); // Close popover
                                      }}
                                      className="text-sm"
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          company.name === field.value ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {company.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />


              {/* Price Fields in a Grid */}
              <div className="grid grid-cols-2 gap-4">
                 {/* Cost Price */}
                 <FormField
                  control={form.control}
                  name="costPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost Price <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="e.g., 150.00" {...field} className="text-base"/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 {/* Selling Price */}
                 <FormField
                  control={form.control}
                  name="sellingPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Selling Price <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="e.g., 250.00" {...field} className="text-base"/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

               {/* Max Discount */}
               <FormField
                control={form.control}
                name="maxDiscount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Discount (%)</FormLabel> {/* No asterisk */}
                    <FormControl>
                       {/* Update field props to handle potential undefined and coerce */}
                       <Input
                         type="number"
                         step="1"
                         min="0" // Ensure non-negative
                         max="100" // Ensure max 100
                         placeholder="e.g., 10 (Optional)"
                         {...field}
                         value={field.value ?? ''} // Ensure value is string or number for input
                         onChange={e => {
                             const value = e.target.value;
                             // Allow empty string for optional field, otherwise parse as number
                             field.onChange(value === '' ? undefined : Number(value));
                         }}
                         className="text-base"
                       />
                    </FormControl>
                     <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="mt-8 gap-2 sm:gap-0">
              <DialogClose asChild>
                  <Button type="button" variant="outline" onClick={handleClose} disabled={isAdding || isAddingCompany} className="w-full sm:w-auto">
                      Cancel
                  </Button>
               </DialogClose>
              <Button type="submit" disabled={isAdding || isAddingCompany || isLoadingCompanies} className="w-full sm:w-auto bg-accent-success hover:bg-accent-success/90 text-accent-success-foreground">
                {isAdding || isAddingCompany ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isAddingCompany ? 'Checking Company...' : 'Adding...'}
                  </>
                ) : (
                    <>
                    <CheckCircle className="mr-2 h-4 w-4" /> Add Product
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

