'use server';

import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';
import { cookies } from 'next/headers';

/**
 * Sets a flag to indicate a new user should see the onboarding flow
 */
export async function markUserForOnboarding() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  // Get or create user preferences
  const preferences = await db.userPreferences.upsert({
    where: {
      userId: user.id,
    },
    update: {
      completedOnboarding: false,
    },
    create: {
      userId: user.id,
      completedOnboarding: false,
    },
  });

  // Also set a cookie for client-side detection
  cookies().set('show_onboarding', 'true', {
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  });

  return { success: true };
}

/**
 * Mark that the user has completed the onboarding flow
 */
export async function markOnboardingComplete() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  await db.userPreferences.upsert({
    where: {
      userId: user.id,
    },
    update: {
      completedOnboarding: true,
    },
    create: {
      userId: user.id,
      completedOnboarding: true,
    },
  });

  // Clear the cookie
  cookies().delete('show_onboarding');

  return { success: true };
}

/**
 * Check if the user should see onboarding
 */
export async function shouldShowOnboarding() {
  const user = await getCurrentUser();

  if (!user) {
    return false;
  }

  const preferences = await db.userPreferences.findUnique({
    where: {
      userId: user.id,
    },
  });

  // New users (no preferences) or users with completedOnboarding = false
  return !preferences || preferences.completedOnboarding === false;
}

/**
 * Save user's onboarding goals and experience level
 */
export async function saveOnboardingGoals(data: {
  goal: string;
  experienceLevel: string;
}) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  // Update user profile with goals
  await db.userProfile.upsert({
    where: { userId: user.id },
    update: {
      careerGoal: data.goal,
      experienceLevel: data.experienceLevel,
    },
    create: {
      user: { connect: { id: user.id } },
      careerGoal: data.goal,
      experienceLevel: data.experienceLevel,
    },
  });

  return { success: true };
}

/**
 * Save user's job preferences from onboarding
 */
export async function saveOnboardingJobPreferences(data: {
  jobTitle: string;
  location: string;
  jobType: string;
  workArrangement: string;
  salaryRange?: string;
}) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  // Parse salary range if provided
  let salaryMin: number | undefined;
  let salaryMax: number | undefined;

  if (data.salaryRange) {
    const salaryMatch = data.salaryRange.match(
      /\$?(\d{1,3}(?:,\d{3})*)\s*-\s*\$?(\d{1,3}(?:,\d{3})*)/,
    );
    if (salaryMatch) {
      salaryMin = parseInt(salaryMatch[1].replace(/,/g, ''));
      salaryMax = parseInt(salaryMatch[2].replace(/,/g, ''));
    }
  }

  // Update job preferences
  await db.userJobPreferences.upsert({
    where: { userId: user.id },
    update: {
      preferredJobTitle: data.jobTitle,
      preferredLocation: data.location,
      preferredJobType: data.jobType,
      preferredWorkArrangement: data.workArrangement,
      preferredSalaryMin: salaryMin,
      preferredSalaryMax: salaryMax,
      isRemoteOnly: data.workArrangement === 'remote',
    },
    create: {
      userId: user.id,
      preferredJobTitle: data.jobTitle,
      preferredLocation: data.location,
      preferredJobType: data.jobType,
      preferredWorkArrangement: data.workArrangement,
      preferredSalaryMin: salaryMin,
      preferredSalaryMax: salaryMax,
      isRemoteOnly: data.workArrangement === 'remote',
    },
  });

  return { success: true };
}

/**
 * Process resume upload from onboarding
 */
export async function processOnboardingResume(file: File) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  // In a real implementation, you would:
  // 1. Upload the file to blob storage
  // 2. Create a resume record
  // 3. Trigger analysis
  // For now, we'll create a placeholder resume record

  const resume = await db.resume.create({
    data: {
      name: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
      description: 'Resume uploaded during onboarding',
      url: 'placeholder-url', // Would be actual blob URL
      userId: user.id,
    },
  });

  // Set as default resume
  await db.user.update({
    where: { id: user.id },
    data: { defaultResumeId: resume.id },
  });

  return { success: true, resumeId: resume.id };
}

/**
 * Execute the user's first job search from onboarding
 */
export async function executeOnboardingJobSearch(data: {
  jobTitle: string;
  location: string;
  jobType: string;
}) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  // Create a job search based on their preferences
  const jobSearch = await db.jobSearch.create({
    data: {
      searchTerm: data.jobTitle,
      location: data.location,
      jobType: data.jobType,
      query: data.jobTitle,
      status: 'PENDING',
      userId: user.id,
      savedAt: new Date(),
      provider: 'INDEED', // Default to Indeed for onboarding
      jobProvider: 'INDEED',
    },
  });

  // In a real implementation, you would trigger the actual job search here
  // For now, we'll just create the search record

  return { success: true, jobSearchId: jobSearch.id };
}

/**
 * Complete the onboarding process and save all data
 */
export async function completeOnboardingProcess(onboardingData: {
  goal: string;
  experienceLevel: string;
  jobTitle: string;
  location: string;
  jobType: string;
  workArrangement: string;
  salaryRange?: string;
  resumeFile?: File;
}) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    // Save all the data in sequence
    await saveOnboardingGoals({
      goal: onboardingData.goal,
      experienceLevel: onboardingData.experienceLevel,
    });

    await saveOnboardingJobPreferences({
      jobTitle: onboardingData.jobTitle,
      location: onboardingData.location,
      jobType: onboardingData.jobType,
      workArrangement: onboardingData.workArrangement,
      salaryRange: onboardingData.salaryRange,
    });

    // Process resume if uploaded
    if (onboardingData.resumeFile) {
      await processOnboardingResume(onboardingData.resumeFile);
    }

    // Execute first job search
    await executeOnboardingJobSearch({
      jobTitle: onboardingData.jobTitle,
      location: onboardingData.location,
      jobType: onboardingData.jobType,
    });

    // Mark onboarding as complete
    await markOnboardingComplete();

    return { success: true };
  } catch (error) {
    console.error('Error completing onboarding:', error);
    throw error;
  }
}
