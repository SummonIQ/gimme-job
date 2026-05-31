// Add this file at app/test-onboarding/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TestOnboardingPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Preparing onboarding test...");
  
  useEffect(() => {
    // Make sure we're running in the browser
    if (typeof window !== 'undefined') {
      try {
        // Clear onboarding status
        localStorage.removeItem("hasCompletedOnboarding");
        localStorage.setItem("isNewUser", "true");
        
        setMessage("Onboarding state reset. Redirecting to app...");
        
        // Add a slight delay to make sure state is set before redirect
        setTimeout(() => {
          router.push("/dashboard");
        }, 1000);
      } catch (error: unknown) {
        console.error("Error setting localStorage:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setMessage(`Error: ${errorMessage}. Please try again.`);
      }
    }
  }, [router]);
  
  return (
    <div className="p-8 text-center">
      <h1 className="text-2xl font-bold mb-4">Onboarding Test</h1>
      <p className="mb-2">{message}</p>
      <p className="text-sm text-muted-foreground">
        This page resets onboarding state and redirects you to the app to test the onboarding flow.
      </p>
    </div>
  );
}