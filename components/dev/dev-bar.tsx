'use client';

import { ArrowUp, Settings, X, Monitor } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/css';

import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { RevalidateCache } from './revalidate-cache';
import { useOnboarding } from '@/components/onboarding/onboarding-context';

// Onboarding Debug Content Component
const OnboardingDebugContent = () => {
  const { 
    isOnboarding, 
    currentStep, 
    hasCompletedOnboarding,
    hasPausedOnboarding,
    startOnboarding,
    completeOnboarding,
    skipOnboarding,
    restartOnboarding,
    nextStep,
    prevStep,
    pauseOnboarding,
    resumeOnboarding
  } = useOnboarding();

  const [localStorageState, setLocalStorageState] = useState<{
    isNewUser: string | null;
    hasCompletedOnboarding: string | null;
  }>({
    isNewUser: null,
    hasCompletedOnboarding: null
  });

  // Check localStorage values on mount and when they might change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setLocalStorageState({
        isNewUser: localStorage.getItem("isNewUser"),
        hasCompletedOnboarding: localStorage.getItem("hasCompletedOnboarding")
      });
    }
  }, [isOnboarding, hasCompletedOnboarding]);

  const resetStorage = () => {
    localStorage.removeItem("hasCompletedOnboarding");
    localStorage.setItem("isNewUser", "true");
    setLocalStorageState({
      isNewUser: "true",
      hasCompletedOnboarding: null
    });
  };

  return (
    <div className="space-y-3 text-xs">
      {/* Main onboarding modal toggle */}
      <Button 
        variant={isOnboarding ? "destructive" : "default"}
        size="sm" 
        className="w-full h-8 text-sm font-medium"
        onClick={() => isOnboarding ? pauseOnboarding() : (hasPausedOnboarding ? resumeOnboarding() : startOnboarding())}
      >
        {isOnboarding ? "Hide Onboarding Modal" : "Show Onboarding Modal"}
      </Button>
      
      <Separator className="my-2" />
      
      <div className="flex justify-between items-center">
        <h4 className="font-medium">Debug State</h4>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-6 text-xs"
          onClick={() => resetStorage()}
        >
          Reset State
        </Button>
      </div>
      
      <div className="space-y-1">
        <div>
          <span className="text-muted-foreground">isOnboarding:</span>{" "}
          <span className={isOnboarding ? "text-green-500" : "text-red-500"}>
            {isOnboarding ? "true" : "false"}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">hasPausedOnboarding:</span>{" "}
          <span className={hasPausedOnboarding ? "text-yellow-500" : "text-muted-foreground"}>
            {hasPausedOnboarding ? "true" : "false"}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">currentStep:</span>{" "}
          <span className="font-mono">{currentStep}</span>
        </div>
        <div>
          <span className="text-muted-foreground">hasCompletedOnboarding:</span>{" "}
          <span className={hasCompletedOnboarding ? "text-green-500" : "text-red-500"}>
            {hasCompletedOnboarding ? "true" : "false"}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">localStorage.isNewUser:</span>{" "}
          <span>{localStorageState.isNewUser || "null"}</span>
        </div>
        <div>
          <span className="text-muted-foreground">localStorage.hasCompletedOnboarding:</span>{" "}
          <span>{localStorageState.hasCompletedOnboarding || "null"}</span>
        </div>
      </div>

      <Separator className="my-2" />
      
      <div className="space-y-2">
        <h4 className="font-medium">Quick Actions</h4>
        <div className="grid grid-cols-3 gap-1">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-6 text-xs"
            onClick={() => startOnboarding()}
            disabled={isOnboarding}
          >
            Start
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-6 text-xs"
            onClick={() => restartOnboarding()}
          >
            Restart
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-6 text-xs"
            onClick={() => completeOnboarding()}
            disabled={!isOnboarding}
          >
            Complete
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-6 text-xs"
            onClick={() => prevStep()}
            disabled={!isOnboarding || currentStep === 'welcome'}
          >
            ← Prev
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-6 text-xs"
            onClick={() => nextStep()}
            disabled={!isOnboarding || currentStep === 'complete'}
          >
            Next →
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-6 text-xs"
            onClick={() => skipOnboarding()}
            disabled={!isOnboarding}
          >
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
};

// Define tool types
interface BuiltInTool {
  type: 'built-in';
  component: React.ComponentType;
}

interface ProjectTool {
  type: 'project';
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}

export function DevBar() {
  const pathName = usePathname();
  const [showOnboardingPanel, setShowOnboardingPanel] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  // const targetParentRef = useRef<HTMLDivElement>(null);

  // const modifyNextjsDevIndicator = () => {
  //   console.log('modifying nextjs dev indicator');
  //   const nextjsDevIndicatorPortal =
  //     window.document.body.querySelector('nextjs-portal');
  //   console.log('nextjsDevIndicatorPortal', nextjsDevIndicatorPortal);

  //   // if (!nextjsDevIndicatorPortal) return false;

  //   const nextjsDevIndicator =
  //     nextjsDevIndicatorPortal?.shadowRoot?.querySelector('.nextjs-toast');
  //   console.log('nextjsDevIndicator', nextjsDevIndicator);

  //   if (!nextjsDevIndicator) return false;
  //   console.log(nextjsDevIndicator);

  //   const style = nextjsDevIndicator.getAttribute('style');
  //   // replace z-index: 2147483647; with z-index: 2147483645 !important;
  //   const newStyle = style?.replace(
  //     'z-index: 2147483647;',
  //     'z-index: 1000 !important;',
  //   );
  //   console.log(newStyle);

  //   (nextjsDevIndicator as HTMLElement).style.zIndex = '1000 !important';

  //   if (!newStyle) return false;

  //   nextjsDevIndicator?.setAttribute('style', newStyle);

  //   // if (elementToMove) {
  //   // elementToMove.remove();
  //   // targetParentRef.current?.appendChild(elementToMove);
  //   // }
  //   return true;
  // };

  // useEffect(() => {
  //   let interval: NodeJS.Timeout;
  //   if (typeof window !== 'undefined') {
  //     interval = setInterval(() => {
  //       const modified = modifyNextjsDevIndicator();

  //       if (modified) {
  //         clearInterval(interval);
  //       }
  //     }, 5000);
  //   }

  //   return () => clearInterval(interval);
  // }, []);

  // Define tools configuration
  const builtInTools: BuiltInTool[] = [
    {
      type: 'built-in',
      component: RevalidateCache
    }
  ];

  const projectTools: ProjectTool[] = [
    {
      type: 'project',
      label: showOnboardingPanel ? 'Hide Onboarding Panel' : 'Show Onboarding Panel',
      icon: Monitor,
      onClick: () => setShowOnboardingPanel(!showOnboardingPanel)
    }
  ];

  return (
    <>
      {/* Onboarding Panel */}
      {showOnboardingPanel && (
        <div className={cn(
          "fixed bottom-[70px] left-4 bg-background border border-border rounded-lg shadow-lg z-50 transition-all w-96 p-4"
        )}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-sm">Onboarding Panel</h3>
            <Button 
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setShowOnboardingPanel(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <OnboardingDebugContent />
        </div>
      )}

      {/* Dev Bar */}
      <div
        className={cn(
          'group fixed bottom-4 left-4 flex size-[37px] min-w-[37px] translate-x-0 flex-row flex-nowrap items-center justify-center gap-[7px] overflow-hidden rounded-full border bg-background/30 py-2.5 pr-[5px] shadow-sm backdrop-blur transition-all duration-300 will-change-transform fade-in fade-out',
          'hover:min-w-fit hover:max-w-none hover:translate-x-0 hover:border-foreground/20 hover:pl-[38px] hover:shadow-lg',
          'dark:border-foreground/10 dark:bg-background/70 dark:hover:bg-background/30',
          dropdownOpen && 'min-w-fit max-w-none translate-x-0 border-foreground/20 pl-[38px] shadow-lg'
        )}
      >
        <Separator className="mr-0.5 h-full opacity-50" orientation="vertical" />

        <div className={cn(
          "flex translate-y-[-3px] scale-0 flex-row items-center opacity-0 transition-all delay-0 duration-75",
          "group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-hover:delay-300 group-hover:duration-200",
          dropdownOpen && "translate-y-0 scale-100 opacity-100"
        )}>
          <DropdownMenu modal={false} open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                className="h-[25px] gap-1 rounded-lg border border-muted/60 bg-foreground/25 px-2 pr-3 text-xs drop-shadow-md hover:border-muted/80 hover:bg-foreground/60 hover:text-foreground/80 dark:border-muted/50 dark:bg-background/25 dark:text-foreground/40 dark:hover:!border-foreground/50 dark:hover:text-foreground/70 dark:group-hover:bg-background/40"
                variant="outline"
              >
                <ArrowUp className={cn('!size-3.5', '')} />
                <span>Tools</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              className="rounded-lg border-border/40 bg-background/80 text-foreground/70 shadow-md drop-shadow-lg backdrop-blur-lg"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              {/* Built-in tools */}
              {builtInTools.map((tool, index) => (
                <DropdownMenuItem 
                  key={`built-in-${index}`}
                  className="cursor-pointer hover:bg-foreground hover:text-background text-xs"
                >
                  <tool.component />
                </DropdownMenuItem>
              ))}
              
              {/* Separator between built-in and project tools */}
              {builtInTools.length > 0 && projectTools.length > 0 && (
                <DropdownMenuSeparator />
              )}
              
              {/* Project-specific tools */}
              {projectTools.map((tool, index) => (
                <DropdownMenuItem 
                  key={`project-${index}`}
                  className="cursor-pointer hover:bg-foreground hover:text-background text-xs flex items-center gap-2"
                  onClick={tool.onClick}
                >
                  {tool.icon && <tool.icon className="h-3.5 w-3.5" />}
                  {tool.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Show onboarding panel tab when active */}
        {showOnboardingPanel && (
          <>
            <Separator className="mx-0.5 h-full" orientation="vertical" />
            <div className={cn(
              "flex h-[25px] translate-y-[-3px] scale-0 items-center justify-center rounded-xl bg-blue-500/20 px-2 font-mono text-xs font-semibold text-blue-600 opacity-0 drop-shadow-md transition-all delay-0 duration-75",
              "group-hover:max-w-full group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-hover:delay-200 group-hover:duration-200",
              "dark:text-blue-400",
              dropdownOpen && "max-w-full translate-y-0 scale-100 opacity-100"
            )}>
              Onboarding
            </div>
          </>
        )}

        <div className="absolute left-0 flex size-[35px] items-center justify-center rounded-full bg-background text-foreground/85 transition-all duration-200 group-hover:text-blue-500/90">
          {/* Replace Settings icon with current breakpoint */}
          <div className="font-mono text-xs font-semibold">
            <div className="block sm:hidden">xs</div>
            <div className="hidden sm:block md:hidden">sm</div>
            <div className="hidden md:block lg:hidden">md</div>
            <div className="hidden lg:block xl:hidden">lg</div>
            <div className="hidden xl:block 2xl:hidden">xl</div>
            <div className="hidden 2xl:block">2xl</div>
          </div>
        </div>
      </div>
    </>
  );
}
