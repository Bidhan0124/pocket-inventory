"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    // Provider sets duration and swipe direction for all toasts
    <ToastProvider swipeDirection="right" duration={4000}>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props} className="shadow-lg rounded-lg border data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-full sm:data-[state=closed]:slide-out-to-right-full sm:data-[state=open]:slide-in-from-top-full sm:data-[state=open]:sm:slide-in-from-bottom-full">
             <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      {/* Viewport controls the positioning of the toasts group */}
      <ToastViewport className="fixed bottom-0 left-0 right-0 p-4 flex flex-col-reverse gap-3 z-[100] sm:bottom-0 sm:right-0 sm:left-auto sm:top-auto sm:flex-col sm:max-w-[420px]" />
    </ToastProvider>
  )
}
