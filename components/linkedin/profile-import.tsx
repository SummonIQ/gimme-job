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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { importLinkedInProfile } from "@/lib/linkedin/profile-import";
import { getAuthUrl } from "@/lib/api/linkedin-client";
import { Loader2, Check, XCircle, Briefcase, GraduationCap, Tag } from "lucide-react";
import Image from "next/image";

interface LinkedInProfileImportProps {
  redirectUri?: string;
}

export function LinkedInProfileImport({ redirectUri }: LinkedInProfileImportProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  // Handle profile import
  const handleImport = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);
      
      const result = await importLinkedInProfile();
      
      if (result.authRequired) {
        setNeedsAuth(true);
        return;
      }
      
      if (!result.success) {
        setError(result.error || "Failed to import LinkedIn profile");
        return;
      }
      
      setSuccess(true);
      setProfileData(result.data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Handle LinkedIn authentication
  const handleAuthenticate = () => {
    // Default redirect URI if not provided
    const actualRedirectUri = redirectUri || `${window.location.origin}/linkedin/callback`;
    
    // Get LinkedIn auth URL and redirect
    try {
      const authUrl = getAuthUrl(actualRedirectUri);
      window.location.href = authUrl;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to generate authentication URL");
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center">
          <svg className="h-6 w-6 mr-2" fill="#0A66C2" viewBox="0 0 24 24">
            <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"></path>
          </svg>
          LinkedIn Profile Import
        </CardTitle>
        <CardDescription>
          Import your LinkedIn profile to enhance your job applications and resume building
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {needsAuth ? (
          <Alert className="mb-4">
            <AlertTitle>LinkedIn Authentication Required</AlertTitle>
            <AlertDescription>
              To import your LinkedIn profile, you need to authenticate with LinkedIn first.
              Click the button below to connect your account.
            </AlertDescription>
          </Alert>
        ) : error ? (
          <Alert variant="destructive" className="mb-4">
            <XCircle className="h-4 w-4 mr-2" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : success && profileData ? (
          <div className="space-y-6">
            <Alert variant="default" className="bg-green-50 border-green-200 mb-4">
              <Check className="h-4 w-4 text-green-600 mr-2" />
              <AlertTitle>Success!</AlertTitle>
              <AlertDescription>
                Your LinkedIn profile has been imported successfully.
              </AlertDescription>
            </Alert>
            
            <div className="flex items-start gap-4">
              {profileData.profilePictureUrl && (
                <Image 
                  src={profileData.profilePictureUrl} 
                  width={80} 
                  height={80} 
                  alt="LinkedIn Profile" 
                  className="rounded-md object-cover"
                />
              )}
              
              <div>
                <h3 className="text-xl font-semibold">
                  {profileData.firstName} {profileData.lastName}
                </h3>
                {profileData.headline && (
                  <p className="text-sm text-muted-foreground">{profileData.headline}</p>
                )}
                {profileData.location?.city && profileData.location?.country && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {profileData.location.city}, {profileData.location.country}
                  </p>
                )}
              </div>
            </div>
            
            {profileData.positions && profileData.positions.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold flex items-center mb-2">
                  <Briefcase className="h-4 w-4 mr-1" /> Work Experience
                </h4>
                <ul className="space-y-3">
                  {profileData.positions.slice(0, 3).map((position: any, index: number) => (
                    <li key={index} className="text-sm">
                      <div className="font-medium">{position.title}</div>
                      <div>{position.company}</div>
                      {position.startDate && (
                        <div className="text-xs text-muted-foreground">
                          {`${position.startDate.year}-${position.startDate.month || ''}${position.endDate ? ` to ${position.endDate.year}-${position.endDate.month || ''}` : ' to Present'}`}
                        </div>
                      )}
                    </li>
                  ))}
                  {profileData.positions.length > 3 && (
                    <li className="text-xs text-muted-foreground">
                      +{profileData.positions.length - 3} more positions
                    </li>
                  )}
                </ul>
              </div>
            )}
            
            {profileData.education && profileData.education.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold flex items-center mb-2">
                  <GraduationCap className="h-4 w-4 mr-1" /> Education
                </h4>
                <ul className="space-y-3">
                  {profileData.education.slice(0, 2).map((edu: any, index: number) => (
                    <li key={index} className="text-sm">
                      <div className="font-medium">{edu.school}</div>
                      {edu.degree && edu.fieldOfStudy && (
                        <div>{edu.degree}, {edu.fieldOfStudy}</div>
                      )}
                      {edu.startDate && (
                        <div className="text-xs text-muted-foreground">
                          {`${edu.startDate.year}${edu.endDate ? ` to ${edu.endDate.year}` : ' to Present'}`}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {profileData.skills && profileData.skills.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold flex items-center mb-2">
                  <Tag className="h-4 w-4 mr-1" /> Skills
                </h4>
                <div className="flex flex-wrap gap-1">
                  {profileData.skills.slice(0, 10).map((skill: any, index: number) => (
                    <span 
                      key={index} 
                      className="text-xs bg-muted px-2 py-1 rounded-md"
                    >
                      {skill.name}
                    </span>
                  ))}
                  {profileData.skills.length > 10 && (
                    <span className="text-xs text-muted-foreground px-2 py-1">
                      +{profileData.skills.length - 10} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <svg className="h-12 w-12 mx-auto mb-4" fill="#0A66C2" viewBox="0 0 24 24">
              <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"></path>
            </svg>
            <p className="text-lg font-medium mb-2">
              Import Your LinkedIn Profile
            </p>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Pull your professional experience, education, and skills directly from LinkedIn 
              to enhance your job applications.
            </p>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-end">
        {needsAuth ? (
          <Button onClick={handleAuthenticate} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Connect LinkedIn Account
          </Button>
        ) : success ? (
          <Button variant="outline" onClick={handleImport} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Refresh Profile
          </Button>
        ) : (
          <Button onClick={handleImport} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Import from LinkedIn
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
