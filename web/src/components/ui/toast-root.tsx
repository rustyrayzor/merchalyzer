"use client";

import React from 'react';
import { ToastProvider } from './toast';

export default function ToastRoot({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {children}
    </ToastProvider>
  );
}

