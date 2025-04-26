
"use client";

import * as React from 'react';
import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Removed Command imports as they are no longer used for company
// Removed Popover imports as they are no longer used for company
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
// Removed Check, ChevronsUpDown from lucide-react
import { PlusCircle, Image as ImageIcon, Loader2, CheckCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// Removed useCompanies hook import as it's no longer directly used for the input
import type { AddProductFormData as ProductFormData } from '@/lib/types'; // Import the refined type
import { cn } from '@/lib/utils';

// Validation schema: Name is now required, Max Discount is optional
export const productSchema = z.object({
  name: z.string().min(1, "Product name is required"), // Name is now required
  company: z.string().optional(), // Optional string input
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
  // Removed companyPopoverOpen state
  // Removed useCompanies hook usage here

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
        // Trim company name before sending
        company: data.company?.trim() || undefined,
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

               {/* Company Input - Simplified */}
               <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                     <FormControl>
                       <Input placeholder="e.g., Brand Name (Optional)" {...field} className="text-base"/>
                     </FormControl>
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
              {/* Removed isLoadingCompanies from disabled condition */}
              <Button type="submit" disabled={isAdding} className="w-full sm:w-auto bg-accent-success hover:bg-accent-success/90 text-accent-success-foreground">
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
