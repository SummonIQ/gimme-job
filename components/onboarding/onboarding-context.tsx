'use client';

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

type OnboardingStep =
  | 'welcome'
  | 'goals'
  | 'job-preferences'
  | 'resume-upload'
  | 'first-search'
  | 'success-tips'
  | 'complete';

interface OnboardingContextProps {
  isOnboarding: boolean;
  currentStep: OnboardingStep;
  hasCompletedOnboarding: boolean;
  hasPausedOnboarding: boolean;
  startOnboarding: () => void;
  completeOnboarding: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipOnboarding: () => void;
  restartOnboarding: () => void;
  goToStep: (step: OnboardingStep) => void;
  pauseOnboarding: () => void;
  resumeOnboarding: () => void;
  // New data management functions
  onboardingData: Record<string, any>;
  updateOnboardingData: (key: string, value: any) => void;
  clearOnboardingData: () => void;
}

const OnboardingContext = createContext<OnboardingContextProps | undefined>(
  undefined,
);

const steps: OnboardingStep[] = [
  'welcome',
  'goals',
  'job-preferences',
  'resume-upload',
  'first-search',
  'success-tips',
  'complete',
];

export const OnboardingProvider = ({ children }: { children: ReactNode }) => {
  const [isOnboarding, setIsOnboarding] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [hasCompletedOnboarding, setHasCompletedOnboarding] =
    useState<boolean>(false);
  const [pausedStep, setPausedStep] = useState<OnboardingStep | null>(null);
  const [onboardingData, setOnboardingData] = useState<Record<string, any>>({});

  // Check local storage on initial load to see if user has completed onboarding
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasCompleted =
        localStorage.getItem('hasCompletedOnboarding') === 'true';
      setHasCompletedOnboarding(hasCompleted);

      // Auto-start onboarding for new users
      const isNewUser = localStorage.getItem('isNewUser') === 'true';

      console.log('[Onboarding] Checking state:', {
        hasCompleted,
        isNewUser,
        willStartOnboarding: isNewUser || false,
      });

      if (isNewUser) {
        console.log('[Onboarding] Starting onboarding flow for new user');
        setIsOnboarding(true);
        localStorage.removeItem('isNewUser'); // Remove flag after starting onboarding
      }
    }
  }, []);

  const startOnboarding = () => {
    setCurrentStep('welcome');
    setIsOnboarding(true);
  };

  const completeOnboarding = () => {
    setIsOnboarding(false);
    setHasCompletedOnboarding(true);
    localStorage.setItem('hasCompletedOnboarding', 'true');
  };

  const nextStep = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    } else {
      completeOnboarding();
    }
  };

  const prevStep = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const skipOnboarding = () => {
    completeOnboarding();
  };

  const restartOnboarding = () => {
    setCurrentStep('welcome');
    setIsOnboarding(true);
  };

  const goToStep = (step: OnboardingStep) => {
    if (steps.includes(step)) {
      setCurrentStep(step);
    }
  };

  const pauseOnboarding = () => {
    if (isOnboarding) {
      setPausedStep(currentStep);
      setIsOnboarding(false);
    }
  };

  const resumeOnboarding = () => {
    if (pausedStep) {
      setCurrentStep(pausedStep);
      setIsOnboarding(true);
      setPausedStep(null);
    }
  };

  const updateOnboardingData = (key: string, value: any) => {
    setOnboardingData(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearOnboardingData = () => {
    setOnboardingData({});
  };

  return (
    <OnboardingContext.Provider
      value={{
        isOnboarding,
        currentStep,
        hasCompletedOnboarding,
        hasPausedOnboarding: pausedStep !== null,
        startOnboarding,
        completeOnboarding,
        nextStep,
        prevStep,
        skipOnboarding,
        restartOnboarding,
        goToStep,
        pauseOnboarding,
        resumeOnboarding,
        onboardingData,
        updateOnboardingData,
        clearOnboardingData,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

const noopOnboarding: OnboardingContextProps = {
  isOnboarding: false,
  currentStep: 'complete',
  hasCompletedOnboarding: true,
  hasPausedOnboarding: false,
  startOnboarding: () => {},
  completeOnboarding: () => {},
  nextStep: () => {},
  prevStep: () => {},
  skipOnboarding: () => {},
  restartOnboarding: () => {},
  goToStep: () => {},
  pauseOnboarding: () => {},
  resumeOnboarding: () => {},
  onboardingData: {},
  updateOnboardingData: () => {},
  clearOnboardingData: () => {},
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    // Return safe defaults instead of crashing — handles Turbopack HMR
    // context identity mismatches and edge-case rendering outside the provider.
    return noopOnboarding;
  }
  return context;
};
