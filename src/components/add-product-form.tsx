
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
} from "@/components/ui/command";
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
import { PlusCircle, Image as ImageIcon, Loader2, CheckCircle, ChevronsUpDown, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCompanies } from "@/hooks/use-companies"; // Import the hook
import type { AddProductFormData as ProductFormData } from '@/lib/types'; // Import the refined type
import { cn } from '@/lib/utils';

// Validation schema: Name is now required, Max Discount is optional
export const productSchema = z.object({
  name: z.string().min(1, "Product name is required"), // Name is now required
  company: z.string().optional(), // Allow free text input
  costPrice: z.coerce.number().min(0, "Cost price must be non-negative"),
  sellingPrice: z.coerce.number().min(0, "Selling price must be non-negative"),
  maxDiscount: z.coerce.number().min(0, "Discount must be non-negative").max(100, "Discount cannot exceed 100%").optional().default(0), // Optional with default
  imageFile: z.instanceof(File).optional(),
});


interface AddProductFormProps {
  onAddProduct: (data: ProductFormData) => void; // Use the imported type
  isAdding: boolean;
}

export function AddProductForm({ onAddProduct, isAdding }: AddProductFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [companyPopoverOpen, setCompanyPopoverOpen] = useState(false);
  const { companies, isLoading: isLoadingCompanies } = useCompanies(); // Use the hook

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      company: "",
      costPrice: 0,
      sellingPrice: 0,
      maxDiscount: 0, // Default to 0
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


  const onSubmit = (data: ProductFormData) => {
    console.log("Form submitted with data:", data);
    // Ensure maxDiscount is a number if it was left empty (should be handled by default now)
    const processedData = {
        ...data,
        maxDiscount: data.maxDiscount ?? 0,
    };
    onAddProduct(processedData); // Pass the processed data including the File object
  };

   // Close dialog and reset form state
   const handleClose = () => {
      setIsOpen(false);
      form.reset(); // Resets to defaultValues including maxDiscount: 0
      setImagePreview(null);
       if(fileInputRef.current) {
          fileInputRef.current.value = '';
        }
    };

    // Reset form and close dialog after successful add (when isAdding becomes false)
    useEffect(() => {
        if (!isAdding && form.formState.isSubmitSuccessful) {
            handleClose();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdding, form.formState.isSubmitSuccessful]);


  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isAdding && setIsOpen(open)}>
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
            {/* Image Upload Section - More centered and prominent */}
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-24 w-24 border-2 border-border shadow-md">
                <AvatarImage src={imagePreview ?? undefined} alt="Product Preview" className="object-cover"/>
                <AvatarFallback className="bg-muted">
                  <ImageIcon className="h-10 w-10 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="max-w-[150px]"
                onClick={() => fileInputRef.current?.click()}
                disabled={isAdding}
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

               {/* Company Selection/Creation */}
               <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <Popover open={companyPopoverOpen} onOpenChange={setCompanyPopoverOpen}>
                       <PopoverTrigger asChild>
                         <FormControl>
                           <Button
                             variant="outline"
                             role="combobox"
                             aria-expanded={companyPopoverOpen}
                             className={cn(
                               "w-full justify-between text-base", // Increased text size
                               !field.value && "text-muted-foreground"
                             )}
                             disabled={isLoadingCompanies || isAdding}
                           >
                              {isLoadingCompanies ? 'Loading...' : field.value || "Select or type company"}
                             <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                           </Button>
                         </FormControl>
                       </PopoverTrigger>
                       <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0">
                          <Command shouldFilter={true}>
                              {/* Allow free text input directly in the command input */}
                               <CommandInput
                                  placeholder="Search or create company..."
                                  value={field.value || ''} // Bind input value
                                  onValueChange={(searchValue) => {
                                       field.onChange(searchValue); // Update form state on typing
                                  }}
                                  className="h-10" // Slightly taller input
                               />
                               <CommandList>
                                   <CommandEmpty>No company found. Type to create.</CommandEmpty>
                                   <CommandGroup>
                                      {companies.map((company) => (
                                       <CommandItem
                                          key={company.id}
                                          value={company.name}
                                          onSelect={(currentValue) => {
                                            form.setValue("company", currentValue === field.value ? "" : currentValue);
                                            setCompanyPopoverOpen(false);
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              field.value === company.name ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          {company.name}
                                        </CommandItem>
                                      ))}
                                       {/* Option to explicitly add the currently typed value */}
                                       {field.value && !companies.some(c => c.name.toLowerCase() === field.value?.toLowerCase()) && (
                                           <CommandItem
                                               key="create-new"
                                               value={field.value} // Use the typed value
                                               onSelect={() => {
                                                  // Value is already set via CommandInput's onValueChange
                                                   setCompanyPopoverOpen(false);
                                               }}
                                               className="text-muted-foreground italic"
                                           >
                                               Create "{field.value}"
                                           </CommandItem>
                                       )}
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
                  <Button type="button" variant="outline" onClick={handleClose} disabled={isAdding} className="w-full sm:w-auto">
                      Cancel
                  </Button>
               </DialogClose>
              <Button type="submit" disabled={isAdding || isLoadingCompanies} className="w-full sm:w-auto bg-accent-success hover:bg-accent-success/90 text-accent-success-foreground">
                {isAdding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...
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

    