import type { Metadata } from 'next';

import { CTASection } from './components/landing/cta-section';
import { DefaultExperienceHeroSection } from './components/landing/default-experience-hero-section';
import { FeaturesSection } from './components/landing/features-section';
import { HeroSection } from './components/landing/hero-section';
import { HowItWorksSection } from './components/landing/how-it-works-section';
import { IntegrationsSection } from './components/landing/integrations-section';
import { ShippingInPublicSection } from './components/landing/shipping-in-public-section';
import { FAQSection } from './components/landing/faq-section';

export const metadata: Metadata = {
  description:
    'Stop copy-pasting your resume. Gimme Job auto-fills applications, tailors your resume with AI, and searches live listings across every major job board so you can focus on interviews instead of form-filling.',
  title: 'Gimme Job - AI-Powered Job Search Automation',
};

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <DefaultExperienceHeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <IntegrationsSection />
      <ShippingInPublicSection />
      <FAQSection />
      <CTASection />
    </>
  );
}
