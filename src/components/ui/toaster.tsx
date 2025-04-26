
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
    // Provider sets default duration and swipe direction for all toasts
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
      {/* Viewport controls the positioning of the toasts group.
          Default: Fixed bottom right on larger screens, bottom on mobile.
          Modified for centered toast: Use fixed, inset-x-0, top-1/2, translate-y-[-50%], items-center for vertical centering.
          Kept existing responsive logic as fallback, but prioritize centering.
      */}
       <ToastViewport className="fixed inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3 p-4 z-[100] sm:bottom-auto sm:right-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-4 sm:translate-y-0 sm:max-w-[420px]" />

    </ToastProvider>
  )
}
