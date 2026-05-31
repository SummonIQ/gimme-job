"use client";

import { useState } from "react";
import { Brain, Briefcase, Check, Database, ExternalLink, Lightbulb, Loader2, MessageSquare, Save, Target } from "lucide-react";
import type { InterviewerDossier } from "@/types/interviewer-research";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";

interface InterviewerDossierCardProps {
  dossier: InterviewerDossier;
  fromCache?: boolean;
  createdAt?: string;
}

export function InterviewerDossierCard({ dossier, fromCache, createdAt }: InterviewerDossierCardProps) {
  const { profile, personality, strategy } = dossier;
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(fromCache);

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/people-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          company: profile.company,
          title: profile.title,
          linkedinUrl: profile.linkedinUrl,
          summary: profile.summary,
          experience: profile.experience || [],
          education: profile.education || [],
          skills: profile.skills || [],
          articles: profile.articles || [],
          socialProfiles: profile.socialProfiles || {},
          personalityData: personality,
          interviewStrategy: strategy,
          researchSources: dossier.researchSources,
          researchedAt: new Date(dossier.researchedAt),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save profile");
      }

      setIsSaved(true);
      toast({
        title: "Profile Saved",
        description: `${profile.name}'s profile has been saved to People Profiles.`,
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Could not save profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-2xl">{profile.name}</CardTitle>
                {fromCache && (
                  <Badge variant="secondary" className="text-xs">
                    <Database className="mr-1 size-3" />
                    Cached
                  </Badge>
                )}
              </div>
              <CardDescription className="text-base">
                {profile.title && <span className="font-medium">{profile.title}</span>}
                {profile.title && " at "}
                <span className="font-medium">{profile.company}</span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isSaved ? (
                <Badge variant="secondary" className="text-xs whitespace-nowrap">
                  <Check className="mr-1 size-3" />
                  Saved to Profiles
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 size-3 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 size-3" />
                      Save Profile
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {profile.linkedinUrl && (
              <a
                href={profile.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="size-3.5" />
                <span className="truncate max-w-[500px]">{profile.linkedinUrl}</span>
              </a>
            )}
            {createdAt && (
              <span className="ml-auto">
                Saved: {formatDate(createdAt)}
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Profile Summary */}
        {profile.summary && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Briefcase className="size-4 text-primary" />
              <h3 className="font-semibold">Professional Summary</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{profile.summary}</p>
          </div>
        )}

        {/* Social Profiles */}
        {profile.socialProfiles && Object.keys(profile.socialProfiles).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {profile.socialProfiles.linkedin && (
              <a
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                href={profile.socialProfiles.linkedin}
                rel="noopener noreferrer"
                target="_blank"
              >
                LinkedIn <ExternalLink className="size-3" />
              </a>
            )}
            {profile.socialProfiles.twitter && (
              <a
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                href={profile.socialProfiles.twitter}
                rel="noopener noreferrer"
                target="_blank"
              >
                Twitter <ExternalLink className="size-3" />
              </a>
            )}
            {profile.socialProfiles.github && (
              <a
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                href={profile.socialProfiles.github}
                rel="noopener noreferrer"
                target="_blank"
              >
                GitHub <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        )}

        <Separator />

        {/* Personality Assessment */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Brain className="size-4 text-purple-500" />
            <h3 className="font-semibold">Personality Assessment</h3>
          </div>

          <div className="space-y-3 rounded-md border border-border/50 bg-muted/30 p-4">
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase">Communication Style</span>
              <p className="mt-1 text-sm">{personality.communicationStyle}</p>
            </div>

            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase">Decision Making</span>
              <p className="mt-1 text-sm">{personality.decisionMakingApproach}</p>
            </div>

            {personality.leadershipStyle && (
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase">Leadership Style</span>
                <p className="mt-1 text-sm">{personality.leadershipStyle}</p>
              </div>
            )}

            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase">Key Traits</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {personality.personalityTraits.map((trait, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {trait}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-border/50">
              <p className="text-sm text-muted-foreground leading-relaxed">{personality.assessmentSummary}</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Interview Strategy */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Target className="size-4 text-green-500" />
            <h3 className="font-semibold">Interview Strategy</h3>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="talking-points">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Lightbulb className="size-4 text-yellow-500" />
                  <span>Key Talking Points</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 text-sm">
                  {strategy.keyTalkingPoints.map((point, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="text-primary font-medium">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="questions">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-4 text-blue-500" />
                  <span>Questions to Ask</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 text-sm">
                  {strategy.questionsToAsk.map((question, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="text-primary font-medium">•</span>
                      <span>{question}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="conversation-starters">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-4 text-indigo-500" />
                  <span>Conversation Starters</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 text-sm">
                  {strategy.conversationStarters.map((starter, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="text-primary font-medium">•</span>
                      <span>{starter}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="cultural-fit">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Target className="size-4 text-emerald-500" />
                  <span>Cultural Fit</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground">{strategy.culturalFit}</p>
              </AccordionContent>
            </AccordionItem>

            {strategy.topicsToAvoid.length > 0 && (
              <AccordionItem value="topics-to-avoid">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <span className="text-red-500">⚠️</span>
                    <span>Topics to Be Careful With</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 text-sm">
                    {strategy.topicsToAvoid.map((topic, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="text-red-500 font-medium">•</span>
                        <span>{topic}</span>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>

        {/* Research Metadata */}
        <div className="pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Researched on {new Date(dossier.researchedAt).toLocaleDateString()} • {dossier.researchSources.length} sources analyzed
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
