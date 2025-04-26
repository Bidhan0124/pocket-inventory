
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
// Keep Avatar imports only if used elsewhere, otherwise remove
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCompanies } from '@/hooks/use-companies'; // Import hook to fetch/add companies
import type { AddProductFormData as ProductFormData } from '@/lib/types'; // Import the refined type
import { cn } from '@/lib/utils';
import Image from 'next/image'; // Use next/image for preview

// Validation schema: Name is required, Max Discount is optional
export const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  company: z.string().optional(), // Selected company name (string)
  costPrice: z.coerce.number().min(0, "Cost price must be non-negative"),
  sellingPrice: z.coerce.number().min(0, "Selling price must be non-negative"),
  maxDiscount: z.coerce.number().min(0, "Discount must be non-negative").max(100, "Discount cannot exceed 100%").optional().default(0),
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
  const { companies = [], addCompany, isAddingCompany, isLoading: isLoadingCompanies } = useCompanies(); // Destructure companies list and addCompany mutation

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      company: "", // Initialize as empty string
      costPrice: 0,
      sellingPrice: 0,
      maxDiscount: 0,
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
    console.log("Form submitted with data:", data);

    let finalCompanyName = data.company?.trim();

     // If a company name was typed but doesn't exactly match an existing one, add it.
     // This check prevents adding duplicates if the user selects from the list vs typing an existing name.
     if (finalCompanyName && !companies.some(c => c.name === finalCompanyName)) {
       try {
         console.log(`Company "${finalCompanyName}" not in list, attempting to add...`);
         await addCompany(finalCompanyName); // Await the addition
         console.log(`Company "${finalCompanyName}" added successfully.`);
       } catch (error) {
         console.error(`Failed to add company "${finalCompanyName}"`, error);
         // Decide if you want to proceed without the company or show an error
         // For now, let's proceed but clear the company field
         // finalCompanyName = undefined; // Clear company if add fails? Or keep typed value? Let's keep it for now.
       }
     }


    const processedData = {
        ...data,
        maxDiscount: data.maxDiscount ?? 0,
        company: finalCompanyName || undefined, // Use the potentially added/verified name
    };
    onAddProduct(processedData);
  };

   // Close dialog and reset form state
   const handleClose = () => {
      setIsOpen(false);
      form.reset();
      setImagePreview(null);
       if(fileInputRef.current) {
          fileInputRef.current.value = '';
        }
    };

    // Reset form and close dialog after successful add
    useEffect(() => {
        if (!isAdding && form.formState.isSubmitSuccessful) {
            handleClose();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdding, form.formState.isSubmitSuccessful]);


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
                disabled={isAdding || isAddingCompany}
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
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Company</FormLabel>
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
                            {field.value
                              ? companies.find(
                                  (company) => company.name === field.value
                                )?.name ?? `Add "${field.value}"...` // Show typed value or 'Add...' prompt
                              : "Select or type company..."}
                             {isLoadingCompanies ? (
                                <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
                             ) : (
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                             )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0">
                        <Command shouldFilter={false} > {/* Disable default filtering, we handle it */}
                          <CommandInput
                            placeholder="Search or add company..."
                            value={field.value || ''} // Use field.value for input display
                            onValueChange={(search) => field.onChange(search)} // Update form state on type
                            className="text-base h-11"
                            disabled={isLoadingCompanies || isAdding || isAddingCompany}
                          />
                          <CommandList>
                            <CommandEmpty>
                               {field.value?.trim() ? (
                                    <CommandItem
                                        onSelect={() => {
                                            // No need to call addCompany here, onSubmit handles it
                                            form.setValue("company", field.value?.trim()); // Confirm trimmed value
                                            setCompanyPopoverOpen(false);
                                        }}
                                        className="text-sm cursor-pointer"
                                    >
                                        <PlusCircle className="mr-2 h-4 w-4" />
                                        Add "{field.value.trim()}"
                                    </CommandItem>
                                ) : (
                                    <span className="py-6 text-center text-sm">No company found. Type to add.</span>
                                )}
                            </CommandEmpty>
                            <CommandGroup heading="Suggestions">
                              {companies
                                .filter(company => company.name.toLowerCase().includes((field.value || '').toLowerCase()))
                                .map((company) => (
                                <CommandItem
                                  value={company.name} // Use name for value
                                  key={company.id}
                                  onSelect={(currentValue) => {
                                    form.setValue("company", currentValue === field.value ? "" : currentValue); // Set selected value
                                    setCompanyPopoverOpen(false);
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
                )}
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
                         placeholder="e.g., 10 (Optional)"
                         {...field}
                         value={field.value ?? ''} // Ensure value is string or number for input
                         onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} // Handle empty string for optional number
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
