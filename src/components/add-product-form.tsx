
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

// Validation schema (keep zod for validation)
export const productSchema = z.object({
  name: z.string().optional(),
  company: z.string().optional(), // Allow free text input
  costPrice: z.coerce.number().min(0, "Cost price must be non-negative"),
  sellingPrice: z.coerce.number().min(0, "Selling price must be non-negative"),
  maxDiscount: z.coerce.number().min(0, "Discount must be non-negative").max(100, "Discount cannot exceed 100%"),
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


  const onSubmit = (data: ProductFormData) => {
    console.log("Form submitted with data:", data);
    onAddProduct(data); // Pass the raw form data including the File object
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
        <Button className="fixed bottom-6 right-6 rounded-full h-14 w-14 p-0 shadow-lg z-20">
          <PlusCircle className="h-7 w-7" />
          <span className="sr-only">Add Product</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
          <DialogDescription>
            Fill in the details for the new product. Fields marked * are required.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Image Upload Section */}
            <div className="grid grid-cols-3 items-center gap-4">
                 <Label htmlFor="product-image" className="col-span-1 text-right">
                    Image
                  </Label>
               <div className="col-span-2 flex items-center gap-4">
                 <Avatar className="h-16 w-16 border">
                   <AvatarImage src={imagePreview ?? undefined} alt="Product Preview" />
                   <AvatarFallback>
                     <ImageIcon className="h-8 w-8 text-muted-foreground" />
                   </AvatarFallback>
                 </Avatar>
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    Upload
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
             </div>

            {/* Product Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="grid grid-cols-3 items-center gap-4">
                  <FormLabel className="text-right">Name</FormLabel>
                  <FormControl className="col-span-2">
                    <Input placeholder="Optional: e.g., T-Shirt" {...field} />
                  </FormControl>
                  <FormMessage className="col-span-2 col-start-2" />
                </FormItem>
              )}
            />

             {/* Company Selection/Creation */}
             <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem className="grid grid-cols-3 items-center gap-4">
                  <FormLabel className="text-right">Company</FormLabel>
                  <Popover open={companyPopoverOpen} onOpenChange={setCompanyPopoverOpen}>
                     <PopoverTrigger asChild className="col-span-2">
                       <FormControl>
                         <Button
                           variant="outline"
                           role="combobox"
                           aria-expanded={companyPopoverOpen}
                           className={cn(
                             "w-full justify-between",
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
                  <FormMessage className="col-span-2 col-start-2" />
                </FormItem>
              )}
            />


             {/* Cost Price */}
             <FormField
              control={form.control}
              name="costPrice"
              render={({ field }) => (
                <FormItem className="grid grid-cols-3 items-center gap-4">
                  <FormLabel className="text-right">Cost Price *</FormLabel>
                  <FormControl className="col-span-2">
                    <Input type="number" step="0.01" placeholder="e.g., 150.00" {...field} />
                  </FormControl>
                  <FormMessage className="col-span-2 col-start-2" />
                </FormItem>
              )}
            />
             {/* Selling Price */}
             <FormField
              control={form.control}
              name="sellingPrice"
              render={({ field }) => (
                <FormItem className="grid grid-cols-3 items-center gap-4">
                  <FormLabel className="text-right">Selling Price *</FormLabel>
                  <FormControl className="col-span-2">
                    <Input type="number" step="0.01" placeholder="e.g., 250.00" {...field} />
                  </FormControl>
                   <FormMessage className="col-span-2 col-start-2" />
                </FormItem>
              )}
            />
             {/* Max Discount */}
             <FormField
              control={form.control}
              name="maxDiscount"
              render={({ field }) => (
                <FormItem className="grid grid-cols-3 items-center gap-4">
                  <FormLabel className="text-right">Max Discount (%) *</FormLabel>
                  <FormControl className="col-span-2">
                    <Input type="number" step="1" placeholder="e.g., 10" {...field} />
                  </FormControl>
                   <FormMessage className="col-span-2 col-start-2" />
                </FormItem>
              )}
            />

            <DialogFooter>
              <DialogClose asChild>
                  <Button type="button" variant="outline" onClick={handleClose} disabled={isAdding}>
                      Cancel
                  </Button>
               </DialogClose>
              <Button type="submit" disabled={isAdding || isLoadingCompanies}>
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

