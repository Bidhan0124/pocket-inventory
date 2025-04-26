
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
import { PlusCircle, Image as ImageIcon, Loader2, CheckCircle, Building } from "lucide-react"; // Added Building icon
import type { AddProductFormData as ProductFormData, Company } from '@/lib/types'; // Import the refined type & Company
import Image from 'next/image'; // Use next/image for preview
import { useToast } from '@/hooks/use-toast'; // Import useToast
import { useCompanies } from '@/hooks/use-companies'; // Import useCompanies hook

// Validation schema: Name is required, Max Discount is optional. Company is optional string.
export const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  company: z.string().optional(), // Company is optional string
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
  const { toast } = useToast(); // Get toast function
  const { companies, isLoading: isLoadingCompanies } = useCompanies(); // Get companies


  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      company: "", // Initialize company field
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


  const onSubmit = (data: ProductFormData) => {
     console.log("Form submitted with data:", data);
    // No need to process defaults here, useInventory hook handles it
    onAddProduct(data); // Pass the raw form data
    // Close the dialog immediately after submitting (or after a very short delay for visual feedback)
    // The background processing is handled by the hook
    const timer = setTimeout(() => {
        handleClose();
    }, 100); // Short delay (100ms) before closing
    return () => clearTimeout(timer); // Cleanup timeout
  };

   // Close dialog and reset form state
   const handleClose = () => {
      setIsOpen(false);
      form.reset({ // Reset with default values
         name: "",
         company: "", // Reset company field
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

    // No longer need useEffect to close based on isAdding state
    // useEffect(() => {
    //     if (form.formState.isSubmitted && !isAdding) {
    //          const timer = setTimeout(() => {
    //             handleClose();
    //          }, 500);
    //          return () => clearTimeout(timer);
    //     }
    // }, [isAdding, form.formState.isSubmitted, handleClose, form.reset, form.formState]);


  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) { // Handle closing explicitly
            handleClose();
        } else {
            setIsOpen(true);
        }
    }}>
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

               {/* Company Name (Datalist Input) */}
               <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        Company Name (Optional)
                    </FormLabel>
                    <FormControl>
                        {/* Wrap Input and datalist in a div to fix Fragment prop error */}
                        <div>
                          <Input
                              placeholder="Type or select company..."
                              {...field}
                              list="company-suggestions"
                              className="text-base"
                              disabled={isLoadingCompanies} // Disable while loading companies
                          />
                          <datalist id="company-suggestions">
                              {!isLoadingCompanies && companies.map((company) => (
                                  <option key={company.id} value={company.name} />
                              ))}
                          </datalist>
                        </div>
                    </FormControl>
                     {isLoadingCompanies && <p className="text-xs text-muted-foreground">Loading companies...</p>}
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
              <Button type="button" variant="outline" onClick={handleClose} disabled={isAdding} className="w-full sm:w-auto">
                   Cancel
              </Button>
              <Button type="submit" disabled={isAdding} className="w-full sm:w-auto bg-accent-success hover:bg-accent-success/90 text-accent-success-foreground">
                {isAdding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
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

