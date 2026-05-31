"use client";

import { useState, useEffect } from "react";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipTrigger, 
  TooltipProvider 
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { X, HelpCircle } from "lucide-react";

interface ContextualTipProps {
  id: string;
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  showInitially?: boolean;
  persistent?: boolean;
}

export const ContextualTip = ({ 
  id, 
  content, 
  children, 
  side = "top",
  align = "center",
  showInitially = false,
  persistent = false
}: ContextualTipProps) => {
  const [open, setOpen] = useState(showInitially);
  const [dismissed, setDismissed] = useState(false);
  
  // Check if this tip has been dismissed before
  useEffect(() => {
    if (!persistent) {
      const dismissedTips = JSON.parse(localStorage.getItem('dismissedTips') || '{}');
      setDismissed(!!dismissedTips[id]);
    }
  }, [id, persistent]);

  // Save dismissed state to localStorage
  const handleDismiss = () => {
    setOpen(false);
    
    if (!persistent) {
      const dismissedTips = JSON.parse(localStorage.getItem('dismissedTips') || '{}');
      dismissedTips[id] = true;
      localStorage.setItem('dismissedTips', JSON.stringify(dismissedTips));
      setDismissed(true);
    }
  };

  // Reset all dismissed tips (for testing)
  const resetAllTips = () => {
    localStorage.removeItem('dismissedTips');
    window.location.reload();
  };

  if (dismissed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex items-center">
              {children}
              <HelpCircle className="ml-1 h-4 w-4 text-muted-foreground" />
            </div>
          </TooltipTrigger>
          <TooltipContent side={side} align={align}>
            {content}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center">
            {children}
            <Button
              variant="ghost"
              size="icon"
              className="ml-1 h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(true)}
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side={side} 
          align={align}
          className="p-4 max-w-xs"
        >
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex-1">{content}</div>
              <Button
                variant="ghost"
                size="icon"
                className="-mr-2 -mt-2 h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                onClick={handleDismiss}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {!persistent && (
              <div className="text-xs text-muted-foreground">
                This tip won't show again after dismissal.
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
