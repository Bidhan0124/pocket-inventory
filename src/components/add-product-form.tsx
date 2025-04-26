"use client";

import * as React from 'react'; // Added missing React import
import { useState, useRef, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // Using textarea for name/company for potentially longer inputs
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
import { PlusCircle, Image as ImageIcon, Loader2, CheckCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


// Validation schema
const productSchema = z.object({
  name: z.string().optional(),
  company: z.string().optional(),
  costPrice: z.coerce.number().min(0, "Cost price must be non-negative"),
  sellingPrice: z.coerce.number().min(0, "Selling price must be non-negative"),
  maxDiscount: z.coerce.number().min(0, "Discount must be non-negative").max(100, "Discount cannot exceed 100%"),
  imageFile: z.instanceof(File).optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface AddProductFormProps {
  onAddProduct: (data: ProductFormData & { tempId?: string }) => void; // Allow tempId for offline
  isAdding: boolean;
}

export function AddProductForm({ onAddProduct, isAdding }: AddProductFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      form.setValue("imageFile", file); // Set file object in form state
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
    onAddProduct(data);
     // Keep dialog open while adding, close on success (handled by parent via isAdding potentially)
     // Reset form only after successful submission ideally.
     // For now, reset immediately after triggering add.
     // form.reset(); // Reset form fields
     // setImagePreview(null); // Clear image preview
     // fileInputRef.current && (fileInputRef.current.value = ''); // Clear file input visually
     // setIsOpen(false); // Close the dialog
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
    // biome-ignore lint/correctness/useExhaustiveDependencies: Need to react to isAdding and submit state
    React.useEffect(() => {
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
                  {/* Hidden file input */}
                  <FormField
                       control={form.control}
                       name="imageFile"
                       render={({ field }) => (
                          <FormItem className="hidden">
                             <FormControl>
                                <Input
                                  type="file"
                                  accept="image/*"
                                  ref={fileInputRef}
                                  onChange={handleImageChange}
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
            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem className="grid grid-cols-3 items-center gap-4">
                  <FormLabel className="text-right">Company</FormLabel>
                  <FormControl className="col-span-2">
                    <Input placeholder="Optional: e.g., Brand Name" {...field} />
                  </FormControl>
                  <FormMessage className="col-span-2 col-start-2" />
                </FormItem>
              )}
            />
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
              <Button type="submit" disabled={isAdding}>
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
