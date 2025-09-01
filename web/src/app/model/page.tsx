"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ModelPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main page with model section active
    router.replace("/?page=model");
  }, [router]);

  return (
    <div className="max-w-7xl mx-auto p-6 flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to Model...</p>
      </div>
    </div>
  );
}


