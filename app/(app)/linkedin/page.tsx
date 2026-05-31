import { Page, PageContent, PageHeader } from '@/components/layout/page';
import { LinkedInProfileImport } from '@/components/linkedin/profile-import';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getLinkedInProfileData } from '@/lib/linkedin/profile-import';
import { getCurrentUser } from '@/lib/user/query';
import { Briefcase, GraduationCap, Tag } from 'lucide-react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: 'LinkedIn Profile | Gimme Job',
  description: 'Manage your LinkedIn profile integration',
};

export default async function LinkedInPage() {
  const user = await getCurrentUser();
  if (!user) {
    notFound();
  }

  // Get LinkedIn profile data
  const profileData = await getLinkedInProfileData();
  const hasProfile = !!profileData;

  return (
    <Page name="linkedin-profile" title="LinkedIn Profile">
      <PageHeader
        title="LinkedIn Profile"
        description="Manage your LinkedIn profile integration and networking"
      />

      <PageContent>
        <div className="grid gap-6">
          {!hasProfile ? (
            <LinkedInProfileImport redirectUri="/linkedin" />
          ) : (
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <svg
                      className="h-5 w-5 mr-2"
                      fill="#0A66C2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"></path>
                    </svg>
                    Your LinkedIn Profile
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="md:w-1/3">
                      {profileData?.profilePictureUrl && (
                        <div className="mb-4">
                          <img
                            src={profileData.profilePictureUrl}
                            alt="LinkedIn Profile"
                            className="w-32 h-32 object-cover rounded-md"
                          />
                        </div>
                      )}
                      <div>
                        <h3 className="text-xl font-semibold">
                          {profileData?.firstName} {profileData?.lastName}
                        </h3>
                        {profileData?.headline && (
                          <p className="text-muted-foreground mt-1">
                            {profileData.headline}
                          </p>
                        )}
                        {profileData?.location?.city &&
                          profileData?.location?.country && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {profileData.location.city},{' '}
                              {profileData.location.country}
                            </p>
                          )}
                        {profileData?.email && (
                          <p className="text-sm mt-2">{profileData.email}</p>
                        )}
                        {profileData?.publicProfileUrl && (
                          <a
                            href={profileData.publicProfileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary mt-2 block"
                          >
                            View on LinkedIn
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="md:w-2/3">
                      <Tabs defaultValue="experience" className="w-full">
                        <TabsList>
                          <TabsTrigger
                            value="experience"
                            className="flex items-center"
                          >
                            <Briefcase className="h-4 w-4 mr-2" />
                            Experience
                          </TabsTrigger>
                          <TabsTrigger
                            value="education"
                            className="flex items-center"
                          >
                            <GraduationCap className="h-4 w-4 mr-2" />
                            Education
                          </TabsTrigger>
                          <TabsTrigger
                            value="skills"
                            className="flex items-center"
                          >
                            <Tag className="h-4 w-4 mr-2" />
                            Skills
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent
                          value="experience"
                          className="space-y-4 mt-4"
                        >
                          {profileData?.positions &&
                          profileData.positions.length > 0 ? (
                            <ul className="space-y-4">
                              {profileData.positions.map(
                                (position: any, index: number) => (
                                  <li
                                    key={index}
                                    className="border-b pb-3 last:border-b-0 last:pb-0"
                                  >
                                    <div className="font-medium">
                                      {position.title}
                                    </div>
                                    <div>{position.company}</div>
                                    {position.startDate && (
                                      <div className="text-sm text-muted-foreground">
                                        {`${position.startDate.year}-${position.startDate.month || ''}`}
                                        {position.endDate
                                          ? ` to ${position.endDate.year}-${position.endDate.month || ''}`
                                          : ' to Present'}
                                      </div>
                                    )}
                                    {position.description && (
                                      <div className="text-sm mt-2">
                                        {position.description}
                                      </div>
                                    )}
                                  </li>
                                ),
                              )}
                            </ul>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              No work experience found in your LinkedIn profile.
                            </div>
                          )}
                        </TabsContent>

                        <TabsContent
                          value="education"
                          className="space-y-4 mt-4"
                        >
                          {profileData?.education &&
                          profileData.education.length > 0 ? (
                            <ul className="space-y-4">
                              {profileData.education.map(
                                (education: any, index: number) => (
                                  <li
                                    key={index}
                                    className="border-b pb-3 last:border-b-0 last:pb-0"
                                  >
                                    <div className="font-medium">
                                      {education.school}
                                    </div>
                                    {education.degree &&
                                      education.fieldOfStudy && (
                                        <div>
                                          {education.degree},{' '}
                                          {education.fieldOfStudy}
                                        </div>
                                      )}
                                    {education.startDate && (
                                      <div className="text-sm text-muted-foreground">
                                        {education.startDate.year}
                                        {education.endDate
                                          ? ` to ${education.endDate.year}`
                                          : ' to Present'}
                                      </div>
                                    )}
                                    {education.description && (
                                      <div className="text-sm mt-2">
                                        {education.description}
                                      </div>
                                    )}
                                  </li>
                                ),
                              )}
                            </ul>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              No education information found in your LinkedIn
                              profile.
                            </div>
                          )}
                        </TabsContent>

                        <TabsContent value="skills" className="mt-4">
                          {profileData?.skills &&
                          profileData.skills.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {profileData.skills.map(
                                (skill: any, index: number) => (
                                  <div
                                    key={index}
                                    className="bg-muted px-3 py-1 rounded-md text-sm"
                                  >
                                    {skill.name}
                                    {skill.proficiency && (
                                      <span className="text-xs ml-1 text-muted-foreground">
                                        ({skill.proficiency})
                                      </span>
                                    )}
                                  </div>
                                ),
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              No skills found in your LinkedIn profile.
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>LinkedIn Integration Benefits</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                        ✓
                      </div>
                      <span>
                        Receive personalized connection suggestions for job
                        leads
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                        ✓
                      </div>
                      <span>
                        Automatically fill in job applications with your profile
                        data
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                        ✓
                      </div>
                      <span>
                        Get notified about network activities related to your
                        job search
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                        ✓
                      </div>
                      <span>
                        Import skills and experience to enhance your resumes
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </PageContent>
    </Page>
  );
}
