'use client';

import { useOnboarding } from '@/components/onboarding/onboarding-context';
import { Button } from '@/components/ui/button';
import { Modal, ModalContent, ModalTitle } from '@/components/ui/modal';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef } from 'react';

// Feature illustrations - import your SVGs or use URLs to images
const illustrations = {
  welcome: '/images/onboarding/welcome.svg',
  'job-search': '/images/onboarding/job-search.svg',
  resumes: '/images/onboarding/resumes.svg',
  applications: '/images/onboarding/applications.svg',
  analytics: '/images/onboarding/analytics.svg',
  networking: '/images/onboarding/networking.svg',
  interviews: '/images/onboarding/interviews.svg',
  'skill-gap': '/images/onboarding/skill-gap.svg',
  complete: '/images/onboarding/complete.svg',
};

// Content for each onboarding step
const content = {
  welcome: {
    title: 'Welcome to GimmeJob',
    description:
      "Your one-stop solution for streamlining your job search process. Let's take a quick tour of what we offer.",
  },
  'job-search': {
    title: 'Smart Job Search',
    description:
      'Find relevant job opportunities across multiple platforms with our AI-powered search tools.',
  },
  resumes: {
    title: 'Resume Management',
    description:
      'Store, organize, and optimize your resumes. Get AI-powered suggestions to make your resume stand out.',
  },
  applications: {
    title: 'Application Tracking',
    description:
      'Keep track of all your applications in one place. Never miss a follow-up or deadline again.',
  },
  analytics: {
    title: 'Performance Analytics',
    description:
      'Get insights into your job search performance and identify areas for improvement.',
  },
  networking: {
    title: 'Networking Tools',
    description:
      'Manage your professional connections and leverage your network for job opportunities.',
  },
  interviews: {
    title: 'Interview Preparation',
    description:
      'Practice for interviews with our AI interview coach and access company-specific question banks.',
  },
  'skill-gap': {
    title: 'Skill Gap Analysis',
    description:
      'Identify skills you need to develop for your target roles and get personalized learning recommendations.',
  },
  complete: {
    title: "You're All Set!",
    description:
      "You've completed the onboarding. Now you're ready to start your optimized job search journey!",
  },
};

// Navigation text
const navigationText = {
  back: 'Back',
  next: 'Next',
  skip: 'Skip',
  getStarted: 'Get Started',
};

export const OnboardingModal = () => {
  const {
    isOnboarding,
    currentStep,
    nextStep,
    prevStep,
    skipOnboarding,
    pauseOnboarding,
  } = useOnboarding();
  // Reference for the primary action button to manage focus
  const primaryButtonRef = useRef<HTMLButtonElement>(null);

  // When modal opens, focus on the primary button after a brief delay
  // to ensure the modal is fully rendered
  useEffect(() => {
    if (isOnboarding) {
      const timer = setTimeout(() => {
        primaryButtonRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOnboarding]);

  // Handle keyboard navigation between steps
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' && !isLastStep) {
      nextStep();
    } else if (e.key === 'ArrowLeft' && !isFirstStep) {
      prevStep();
    }
  };

  // Define step properties
  const isFirstStep = currentStep === 'welcome';
  const isLastStep = currentStep === 'complete';

  // Define all valid steps
  const steps = [
    'welcome',
    'job-search',
    'resumes',
    'applications',
    'analytics',
    'networking',
    'interviews',
    'skill-gap',
    'complete',
  ];
  const currentIndex = steps.indexOf(currentStep);
  const progress = ((currentIndex + 1) / steps.length) * 100;

  return (
    <Modal
      open={isOnboarding}
      onOpenChange={open => {
        if (!open) {
          pauseOnboarding();
        }
      }}
    >
      <ModalContent
        className="sm:max-w-[600px] p-0 overflow-hidden"
        onKeyDown={handleKeyDown}
        aria-describedby="onboarding-description"
      >
        <VisuallyHidden>
          <ModalTitle>
            {content[currentStep as keyof typeof content]?.title ||
              'Onboarding'}
          </ModalTitle>
        </VisuallyHidden>
        <div className="flex flex-col h-full">
          {/* Progress bar */}
          <div className="w-full bg-secondary h-1">
            <div
              className="bg-primary h-1 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="p-6 flex flex-col items-center text-center">
            {/* Image/illustration for the step */}
            <div className="mb-6 bg-accent/10 p-8 rounded-full">
              {/* Replace with actual SVG or image component when available */}
              <div className="w-20 h-20 flex items-center justify-center text-primary">
                {currentStep === 'complete' ? (
                  <CheckCircle size={64} />
                ) : (
                  <div className="text-4xl font-bold">{currentIndex + 1}</div>
                )}
              </div>
            </div>

            {/* Step title */}
            <h2 className="text-2xl font-bold mb-3">
              {content[currentStep as keyof typeof content]?.title}
            </h2>

            {/* Step description */}
            <p
              id="onboarding-description"
              className="text-muted-foreground mb-8"
            >
              {content[currentStep as keyof typeof content]?.description}
            </p>

            {/* Navigation buttons */}
            <div className="flex justify-between w-full pt-4">
              <div>
                {!isFirstStep && (
                  <Button
                    variant="outline"
                    onClick={prevStep}
                    aria-label="Go to previous step"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" aria-hidden="true" />{' '}
                    {navigationText.back}
                  </Button>
                )}
              </div>

              <div className="flex space-x-2">
                {!isLastStep && (
                  <Button
                    variant="ghost"
                    onClick={skipOnboarding}
                    aria-label="Skip onboarding"
                  >
                    {navigationText.skip}
                  </Button>
                )}

                <Button
                  onClick={nextStep}
                  ref={primaryButtonRef}
                  aria-label={
                    isLastStep ? 'Complete onboarding' : 'Go to next step'
                  }
                >
                  {isLastStep ? navigationText.getStarted : navigationText.next}
                  {!isLastStep && (
                    <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
};
