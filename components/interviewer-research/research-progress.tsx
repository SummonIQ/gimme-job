"use client";

import { CheckCircle2, Circle, Loader2, Search, Link as LinkIcon, Brain, Target } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export interface ResearchStep {
  id: string;
  interviewer: string;
  status: "pending" | "in-progress" | "completed" | "error";
  stage: "searching" | "analyzing" | "scraping" | "ai-processing" | "completed";
  message: string;
  searchResults?: Array<{
    title: string;
    url: string;
    snippet: string;
    score: number;
  }>;
  currentUrl?: string;
  progress: number;
}

interface ResearchProgressProps {
  steps: ResearchStep[];
  currentStep: number;
  totalSteps: number;
}

export function ResearchProgress({ steps, currentStep, totalSteps }: ResearchProgressProps) {
  const overallProgress = (currentStep / totalSteps) * 100;

  const getStageIcon = (stage: ResearchStep["stage"], status: ResearchStep["status"]) => {
    if (status === "error") return <Circle className="size-5 text-red-500" />;
    if (status === "completed") return <CheckCircle2 className="size-5 text-green-500" />;
    if (status === "in-progress") return <Loader2 className="size-5 text-primary animate-spin" />;
    
    switch (stage) {
      case "searching":
        return <Search className="size-5 text-muted-foreground" />;
      case "scraping":
        return <LinkIcon className="size-5 text-muted-foreground" />;
      case "analyzing":
        return <Brain className="size-5 text-muted-foreground" />;
      case "ai-processing":
        return <Target className="size-5 text-muted-foreground" />;
      default:
        return <Circle className="size-5 text-muted-foreground" />;
    }
  };

  const getStageLabel = (stage: ResearchStep["stage"]) => {
    switch (stage) {
      case "searching":
        return "Searching Google";
      case "scraping":
        return "Scraping Sources";
      case "analyzing":
        return "Analyzing Data";
      case "ai-processing":
        return "AI Processing";
      case "completed":
        return "Completed";
      default:
        return stage;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="size-5 animate-spin text-primary" />
          Research in Progress
        </CardTitle>
        <CardDescription>
          Researching {totalSteps} interviewer{totalSteps !== 1 ? "s" : ""} and generating dossiers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Overall Progress</span>
            <span className="text-muted-foreground">
              {currentStep} / {totalSteps} interviewers
            </span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>

        {/* Individual Steps */}
        <div className="space-y-4 mt-6">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-4"
            >
              {/* Step Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {getStageIcon(step.stage, step.status)}
                  <div>
                    <div className="font-semibold">{step.interviewer}</div>
                    <div className="text-sm text-muted-foreground">
                      {getStageLabel(step.stage)}
                    </div>
                  </div>
                </div>
                <Badge
                  variant={
                    step.status === "completed"
                      ? "default"
                      : step.status === "error"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {step.status === "in-progress" ? `${step.progress}%` : step.status}
                </Badge>
              </div>

              {/* Current Message */}
              <div className="text-sm text-muted-foreground pl-8">
                {step.message}
              </div>

              {/* Step Progress */}
              {step.status === "in-progress" && (
                <Progress value={step.progress} className="h-1" />
              )}

              {/* Current URL being scraped */}
              {step.currentUrl && (
                <div className="pl-8 text-xs text-muted-foreground flex items-center gap-1">
                  <LinkIcon className="size-3" />
                  <span className="truncate">{step.currentUrl}</span>
                </div>
              )}

              {/* Search Results */}
              {step.searchResults && step.searchResults.length > 0 && (
                <div className="pl-8 space-y-2 mt-3">
                  <div className="text-sm font-medium">
                    Found {step.searchResults.length} results
                  </div>
                  <div className="space-y-2">
                    {step.searchResults.map((result, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 rounded-md border border-border/50 bg-background p-2 text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{result.title}</div>
                          <div className="text-muted-foreground truncate text-[10px]">
                            {result.url}
                          </div>
                          {result.snippet && (
                            <div className="text-muted-foreground mt-1 line-clamp-2">
                              {result.snippet}
                            </div>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px]"
                        >
                          {Math.round(result.score * 100)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
