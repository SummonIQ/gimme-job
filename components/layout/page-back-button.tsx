"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { cn } from '@/lib/utils';

export interface PageBackButtonProps {
  href: string;
  className?: string;
}

export function PageBackButton({ href, className }: PageBackButtonProps) {
  return (
    <Button 
      variant="ghost" 
      size="sm"
      className={cn("gap-1 px-2 h-9", className)}
      asChild
    >
      <Link href={href}>
        <ChevronLeft className="h-4 w-4" />
        <span>Back</span>
      </Link>
    </Button>
  );
}
