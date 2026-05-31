"use server";

import { db } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user/query";
import { refreshTokenIfNeeded } from "@/lib/api/linkedin-client";

interface LinkedInProfileData {
  id: string;
  firstName: string;
  lastName: string;
  headline?: string;
  profilePictureUrl?: string;
  email?: string;
  publicProfileUrl?: string;
  location?: {
    country?: string;
    city?: string;
  };
  positions?: Array<{
    title: string;
    company: string;
    startDate?: { month: number; year: number };
    endDate?: { month: number; year: number };
    description?: string;
    location?: string;
    current: boolean;
  }>;
  education?: Array<{
    school: string;
    degree?: string;
    fieldOfStudy?: string;
    startDate?: { year: number };
    endDate?: { year: number };
    description?: string;
  }>;
  skills?: Array<{
    name: string;
    proficiency?: string;
  }>;
}

/**
 * Import LinkedIn profile data for the current user
 */
export async function importLinkedInProfile(): Promise<{ 
  success: boolean; 
  data?: LinkedInProfileData; 
  error?: string;
  authRequired?: boolean;
}> {
  try {
    // Ensure the user has valid LinkedIn credentials
    const credentials = await refreshTokenIfNeeded();
    if (!credentials) {
      return {
        success: false,
        error: "LinkedIn authentication required",
        authRequired: true
      };
    }

    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: "User not authenticated"
      };
    }

    // Fetch basic profile data using LinkedIn API
    const profileResponse = await fetch("https://api.linkedin.com/v2/me", {
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/json"
      }
    });

    if (!profileResponse.ok) {
      throw new Error(`LinkedIn API error: ${await profileResponse.text()}`);
    }

    const profileData = await profileResponse.json();

    // Fetch email address (requires r_emailaddress permission)
    const emailResponse = await fetch("https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))", {
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/json"
      }
    });

    let email;
    if (emailResponse.ok) {
      const emailData = await emailResponse.json();
      email = emailData.elements?.[0]?.["handle~"]?.emailAddress;
    }

    // Fetch profile picture
    const profilePictureResponse = await fetch("https://api.linkedin.com/v2/me?projection=(id,profilePicture(displayImage~:playableStreams))", {
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/json"
      }
    });

    let profilePictureUrl;
    if (profilePictureResponse.ok) {
      const pictureData = await profilePictureResponse.json();
      profilePictureUrl = pictureData.profilePicture?.["displayImage~"]?.elements?.[0]?.identifiers?.[0]?.identifier;
    }

    // Fetch positions (work experience)
    const positionsResponse = await fetch("https://api.linkedin.com/v2/positions?q=members&projection=(elements*(company,title,timePeriod,description,location))", {
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/json"
      }
    });

    let positions = [];
    if (positionsResponse.ok) {
      const positionsData = await positionsResponse.json();
      positions = positionsData.elements?.map(position => ({
        title: position.title,
        company: position.company?.name,
        startDate: position.timePeriod?.startDate,
        endDate: position.timePeriod?.endDate,
        description: position.description,
        location: position.location?.name,
        current: !position.timePeriod?.endDate
      }));
    }

    // Fetch education
    const educationResponse = await fetch("https://api.linkedin.com/v2/educations?q=members&projection=(elements*(school,degree,fieldOfStudy,timePeriod,description))", {
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/json"
      }
    });

    let education = [];
    if (educationResponse.ok) {
      const educationData = await educationResponse.json();
      education = educationData.elements?.map(edu => ({
        school: edu.school?.name,
        degree: edu.degree,
        fieldOfStudy: edu.fieldOfStudy,
        startDate: edu.timePeriod?.startDate,
        endDate: edu.timePeriod?.endDate,
        description: edu.description
      }));
    }

    // Fetch skills
    const skillsResponse = await fetch("https://api.linkedin.com/v2/skills?q=members&projection=(elements*(name,proficiency))", {
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/json"
      }
    });

    let skills = [];
    if (skillsResponse.ok) {
      const skillsData = await skillsResponse.json();
      skills = skillsData.elements?.map(skill => ({
        name: skill.name,
        proficiency: skill.proficiency
      }));
    }

    // Compile profile data
    const linkedInProfile: LinkedInProfileData = {
      id: profileData.id,
      firstName: profileData.localizedFirstName,
      lastName: profileData.localizedLastName,
      headline: profileData.headline,
      email,
      profilePictureUrl,
      publicProfileUrl: profileData.vanityName ? `https://www.linkedin.com/in/${profileData.vanityName}` : undefined,
      location: {
        country: profileData.locationCountry,
        city: profileData.locationName
      },
      positions,
      education,
      skills
    };

    // Store the profile data in the database
    await storeLinkedInProfileData(user.id, linkedInProfile);

    return {
      success: true,
      data: linkedInProfile
    };
  } catch (error) {
    console.error("LinkedIn profile import error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during LinkedIn profile import"
    };
  }
}

/**
 * Store LinkedIn profile data in the database
 */
async function storeLinkedInProfileData(userId: string, profileData: LinkedInProfileData): Promise<void> {
  // Store LinkedIn profile
  await db.linkedInProfile.upsert({
    where: {
      userId_linkedInId: {
        userId,
        linkedInId: profileData.id
      }
    },
    update: {
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      headline: profileData.headline || null,
      profilePictureUrl: profileData.profilePictureUrl || null,
      email: profileData.email || null,
      publicProfileUrl: profileData.publicProfileUrl || null,
      locationCountry: profileData.location?.country || null,
      locationCity: profileData.location?.city || null,
      importedAt: new Date(),
      profileData: JSON.stringify({
        positions: profileData.positions || [],
        education: profileData.education || [],
        skills: profileData.skills || []
      })
    },
    create: {
      userId,
      linkedInId: profileData.id,
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      headline: profileData.headline || null,
      profilePictureUrl: profileData.profilePictureUrl || null,
      email: profileData.email || null,
      publicProfileUrl: profileData.publicProfileUrl || null,
      locationCountry: profileData.location?.country || null,
      locationCity: profileData.location?.city || null,
      importedAt: new Date(),
      profileData: JSON.stringify({
        positions: profileData.positions || [],
        education: profileData.education || [],
        skills: profileData.skills || []
      })
    }
  });
}

/**
 * Get LinkedIn profile data for the current user
 */
export async function getLinkedInProfileData(): Promise<LinkedInProfileData | null> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  const profile = await db.linkedInProfile.findFirst({
    where: { userId: user.id }
  });

  if (!profile) {
    return null;
  }

  // Parse JSON fields
  const profileJson = profile.profileData ? JSON.parse(profile.profileData as string) : {};

  return {
    id: profile.linkedInId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    headline: profile.headline || undefined,
    profilePictureUrl: profile.profilePictureUrl || undefined,
    email: profile.email || undefined,
    publicProfileUrl: profile.publicProfileUrl || undefined,
    location: {
      country: profile.locationCountry || undefined,
      city: profile.locationCity || undefined
    },
    positions: profileJson.positions || [],
    education: profileJson.education || [],
    skills: profileJson.skills || []
  };
}

/**
 * Extract skills from LinkedIn profile data
 */
export async function extractSkillsFromProfile(): Promise<string[]> {
  const profileData = await getLinkedInProfileData();
  
  if (!profileData || !profileData.skills) {
    return [];
  }
  
  // Extract skill names and remove duplicates
  const skills = profileData.skills.map(skill => skill.name);
  return [...new Set(skills)];
}
