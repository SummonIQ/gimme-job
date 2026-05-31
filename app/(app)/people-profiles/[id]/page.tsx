import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

export default async function PeopleProfileDetailsPage(props: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const params = await props.params;
  const profile = await db.peopleProfile.findFirst({
    where: {
      id: params.id,
      userId: user.id,
    },
  });

  if (!profile) {
    notFound();
  }

  return (
    <Page name="people-profile-details" title={profile.name}>
      <PageHeader
        title={profile.name}
        description="People research details"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/people-profiles">
              <ArrowLeft className="size-4" />
              Back to People Profiles
            </Link>
          </Button>
        }
      />

      <PageContent className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Company:</span>{' '}
              <span>{profile.company}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Title:</span>{' '}
              <span>{profile.title || '-'}</span>
            </p>
            <p>
              <span className="text-muted-foreground">LinkedIn:</span>{' '}
              {profile.linkedinUrl ? (
                <a
                  className="text-primary hover:underline"
                  href={profile.linkedinUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {profile.linkedinUrl}
                </a>
              ) : (
                <span>-</span>
              )}
            </p>
            {profile.summary ? (
              <p>
                <span className="text-muted-foreground">Summary:</span>{' '}
                <span>{profile.summary}</span>
              </p>
            ) : null}
            <p>
              <span className="text-muted-foreground">Researched:</span>{' '}
              <span>
                {profile.researchedAt
                  ? profile.researchedAt.toLocaleString()
                  : 'Not available'}
              </span>
            </p>
          </CardContent>
        </Card>

        {profile.experience.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Experience</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {profile.experience.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {profile.education.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Education</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {profile.education.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {profile.skills.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Skills</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {profile.skills.map(skill => (
                <Badge key={skill} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {profile.notes ? (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {profile.notes}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {profile.articles.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Articles</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {profile.articles.map(article => (
                  <li key={article}>{article}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {profile.researchSources.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Research Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {profile.researchSources.map(source => (
                  <li key={source}>
                    <a
                      href={source}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline break-all"
                    >
                      {source}
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {profile.tags.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {profile.tags.map(tag => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {profile.socialProfiles ? (
          <Card>
            <CardHeader>
              <CardTitle>Social Profiles</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                {JSON.stringify(profile.socialProfiles, null, 2)}
              </pre>
            </CardContent>
          </Card>
        ) : null}

        {profile.personalityData ? (
          <Card>
            <CardHeader>
              <CardTitle>Personality Data</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                {JSON.stringify(profile.personalityData, null, 2)}
              </pre>
            </CardContent>
          </Card>
        ) : null}

        {profile.interviewStrategy ? (
          <Card>
            <CardHeader>
              <CardTitle>Interview Strategy</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                {JSON.stringify(profile.interviewStrategy, null, 2)}
              </pre>
            </CardContent>
          </Card>
        ) : null}
      </PageContent>
    </Page>
  );
}
