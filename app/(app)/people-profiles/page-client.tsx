'use client';

import { PeopleProfile } from '@/generated/prisma/browser';
import { Users } from 'lucide-react';
import { useState } from 'react';

import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { PeopleProfilesReport } from '@/components/people-profiles/people-profiles-report';
import { PeopleResearchModal } from '@/components/people-research/people-research-modal';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface PeopleProfilesPageProps {
  initialProfiles: PeopleProfile[];
}

export default function PeopleProfilesPage({
  initialProfiles,
}: PeopleProfilesPageProps) {
  const [profiles, setProfiles] = useState<PeopleProfile[]>(initialProfiles);
  const { toast } = useToast();

  const refreshProfiles = async () => {
    try {
      const response = await fetch('/api/people-profiles');
      if (!response.ok) {
        throw new Error('Failed to fetch profiles');
      }
      const data = await response.json();
      setProfiles(data.profiles || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load people profiles.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this profile?')) {
      return;
    }

    try {
      const response = await fetch(`/api/people-profiles/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete profile');
      }

      setProfiles(prev => prev.filter(p => p.id !== id));
      toast({
        title: 'Profile Deleted',
        description: 'The profile has been removed.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete profile.',
        variant: 'destructive',
      });
    }
  };

  const handleExport = (profile: PeopleProfile) => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      profile: {
        name: profile.name,
        company: profile.company,
        title: profile.title,
        linkedinUrl: profile.linkedinUrl,
        summary: profile.summary,
        experience: profile.experience,
        education: profile.education,
        skills: profile.skills,
        articles: profile.articles,
        socialProfiles: profile.socialProfiles,
      },
      personality: profile.personalityData,
      interviewStrategy: profile.interviewStrategy,
      researchSources: profile.researchSources,
      notes: profile.notes,
      tags: profile.tags,
      researchedAt: profile.researchedAt,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${profile.name.replace(/\s+/g, '_')}_${profile.company.replace(/\s+/g, '_')}_profile.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Profile Exported',
      description: `${profile.name}'s profile has been downloaded.`,
    });
  };

  return (
    <Page name="people-profiles" title="People Profiles">
      <PageHeader
        title="People Profiles"
        description="View and manage your saved interviewer profiles"
        actions={
          <PeopleResearchModal
            onResearchComplete={refreshProfiles}
            trigger={
              <Button size="sm">
                <Users className="size-4" />
                Research Person
              </Button>
            }
          />
        }
      />

      <PageContent>
        {/* Empty State */}
        {profiles.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="size-12 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">No Profiles Yet</CardTitle>
              <CardDescription className="text-center max-w-md">
                Start researching interviewers using the Interview Prep tool.
                All research data will be automatically saved here.
              </CardDescription>
              <Button className="mt-4" asChild>
                <a href="/tools/interview-prep">Go to Interview Prep</a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Profiles Report */}
        {profiles.length > 0 && (
          <PeopleProfilesReport
            initialData={profiles}
            onDelete={handleDelete}
            onExport={handleExport}
          />
        )}
      </PageContent>
    </Page>
  );
}
