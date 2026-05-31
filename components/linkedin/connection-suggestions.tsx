"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { suggestConnectionsForJobLead } from "@/lib/linkedin/connection-suggestions";
import { Briefcase, Loader2, Building, GraduationCap, User2, Hash } from "lucide-react";

interface ConnectionSuggestion {
  name: string;
  title?: string;
  company?: string;
  relevance: number;
  reason: string;
  linkedInUrl?: string;
  matchType: 'company' | 'industry' | 'role' | 'skills' | 'school';
}

interface ConnectionSuggestionsProps {
  jobLeadId: string;
  jobTitle?: string;
  companyName?: string;
}

export function ConnectionSuggestions({ 
  jobLeadId,
  jobTitle = "this position",
  companyName = "this company"
}: ConnectionSuggestionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ConnectionSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Generate connection suggestions
  const handleGenerateSuggestions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await suggestConnectionsForJobLead(jobLeadId);
      setSuggestions(result);
      setShowSuggestions(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to generate connection suggestions");
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  // Get icon based on match type
  const getMatchTypeIcon = (matchType: string) => {
    switch (matchType) {
      case 'company':
        return <Building className="h-4 w-4" />;
      case 'industry':
        return <Briefcase className="h-4 w-4" />;
      case 'role':
        return <User2 className="h-4 w-4" />;
      case 'skills':
        return <Hash className="h-4 w-4" />;
      case 'school':
        return <GraduationCap className="h-4 w-4" />;
      default:
        return <User2 className="h-4 w-4" />;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <svg className="h-5 w-5 mr-2" fill="#0A66C2" viewBox="0 0 24 24">
            <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"></path>
          </svg>
          LinkedIn Networking Suggestions
        </CardTitle>
        <CardDescription>
          Find relevant LinkedIn connections that could help with your application for {jobTitle} at {companyName}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
            <p className="text-sm">{error}</p>
            {error.includes("LinkedIn profile not found") && (
              <p className="text-sm mt-2">
                Please import your LinkedIn profile before generating connection suggestions.
              </p>
            )}
          </div>
        )}
        
        {!showSuggestions ? (
          <div className="text-center py-6">
            <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">
              Find Networking Opportunities
            </p>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Get personalized suggestions for LinkedIn connections who might be helpful for this job application.
            </p>
          </div>
        ) : loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-5/6 mt-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              No connection suggestions found. Try importing your LinkedIn profile first or update your profile with more information.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {suggestions.map((suggestion, index) => (
              <Card key={index} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                      {getMatchTypeIcon(suggestion.matchType)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">{suggestion.name}</h3>
                        <Badge variant={suggestion.relevance >= 8 ? "default" : "outline"}>
                          {suggestion.relevance}/10
                        </Badge>
                      </div>
                      
                      {(suggestion.title || suggestion.company) && (
                        <p className="text-sm text-muted-foreground">
                          {suggestion.title}{suggestion.company ? ` at ${suggestion.company}` : ''}
                        </p>
                      )}
                      
                      <p className="text-sm mt-1">
                        {suggestion.reason}
                      </p>
                      
                      {suggestion.linkedInUrl && (
                        <Button variant="link" className="p-0 h-auto text-xs mt-1" asChild>
                          <a href={suggestion.linkedInUrl} target="_blank" rel="noopener noreferrer">
                            View on LinkedIn
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-end">
        <Button 
          onClick={handleGenerateSuggestions} 
          disabled={loading}
          variant={showSuggestions ? "outline" : "default"}
        >
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {showSuggestions ? 'Refresh Suggestions' : 'Generate Suggestions'}
        </Button>
      </CardFooter>
    </Card>
  );
}
