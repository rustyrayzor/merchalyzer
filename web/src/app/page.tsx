'use client';

import { Suspense } from 'react';
import Navigation from '@/components/Navigation';

function NavigationWrapper() {
  return <Navigation />;
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <NavigationWrapper />
    </Suspense>
  );
}
