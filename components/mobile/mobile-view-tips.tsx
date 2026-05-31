"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, Check, Lightbulb, LayoutGrid } from "lucide-react";
import { useState } from "react";

const MOBILE_TIPS = [
  {
    id: 1,
    title: "Use the Mobile Dashboard",
    description: "The mobile dashboard is optimized for small screens and provides quick access to key features.",
    icon: <LayoutGrid className="h-5 w-5" />,
  },
  {
    id: 2,
    title: "Enable Browser Notifications",
    description: "Stay updated on job applications and interviews even when you're away from your computer.",
    icon: <Smartphone className="h-5 w-5" />,
  },
  {
    id: 3,
    title: "Save Jobs for Later",
    description: "Use the save feature to bookmark jobs you want to apply for when you're back on desktop.",
    icon: <Lightbulb className="h-5 w-5" />,
  },
  {
    id: 4,
    title: "Use Progressive Web App",
    description: "Add Gimme Job to your home screen for a more app-like experience on mobile.",
    icon: <Smartphone className="h-5 w-5" />,
  },
  {
    id: 5,
    title: "Quick Application Mode",
    description: "Enable quick apply mode in settings to streamline the application process on mobile.",
    icon: <Check className="h-5 w-5" />,
  },
];

export function MobileViewTips() {
  const [acknowledged, setAcknowledged] = useState<number[]>([]);

  const handleAcknowledge = (id: number) => {
    if (acknowledged.includes(id)) {
      setAcknowledged(acknowledged.filter((item) => item !== id));
    } else {
      setAcknowledged([...acknowledged, id]);
    }
  };

  const isPWAInstalled = () => {
    if (typeof window !== "undefined") {
      // Check if the app is running in standalone mode (installed as PWA)
      return window.matchMedia("(display-mode: standalone)").matches;
    }
    return false;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Smartphone className="h-5 w-5 mr-2" />
          Mobile Tips
        </CardTitle>
        <CardDescription>
          Optimize your mobile experience with these tips
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {MOBILE_TIPS.map((tip) => (
          <div
            key={tip.id}
            className={`flex items-start space-x-3 p-3 rounded-md transition-colors ${
              acknowledged.includes(tip.id)
                ? "bg-muted/40 text-muted-foreground"
                : "bg-muted"
            }`}
          >
            <div className="mt-0.5 bg-primary/10 p-2 rounded-md">
              {tip.icon}
            </div>
            
            <div className="flex-1">
              <h4 className="text-sm font-medium">{tip.title}</h4>
              <p className="text-xs text-muted-foreground mt-1">
                {tip.description}
              </p>
              
              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto text-xs mt-1"
                onClick={() => handleAcknowledge(tip.id)}
              >
                {acknowledged.includes(tip.id)
                  ? "Mark as unread"
                  : "Mark as read"}
              </Button>
            </div>
            
            {acknowledged.includes(tip.id) && (
              <Check className="h-4 w-4 text-green-500 shrink-0 mt-1" />
            )}
          </div>
        ))}
        
        {/* PWA Installation Tip */}
        {!isPWAInstalled() && (
          <div className="mt-6 border border-dashed rounded-md p-4">
            <h3 className="font-medium text-sm">Install as App</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-3">
              Add Gimme Job to your home screen for a better mobile experience.
            </p>
            <Button size="sm" className="w-full">
              <Smartphone className="h-4 w-4 mr-2" /> Install App
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
