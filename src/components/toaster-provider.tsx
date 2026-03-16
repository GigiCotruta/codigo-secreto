"use client";

import { Toaster } from "sonner";

export function ToasterProvider() {
  return (
    <Toaster
      richColors
      position="top-center"
      toastOptions={{
        className: "text-sm",
      }}
    />
  );
}
