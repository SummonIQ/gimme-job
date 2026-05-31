import { db } from '@/lib/db/client';
import type { PortfolioTemplate, PortfolioTheme } from '@/generated/prisma/browser';

interface TemplateConfig {
  sections: TemplateSection[];
  styling: TemplateStyling;
  layout: TemplateLayout;
}

interface TemplateSection {
  id: string;
  type: 'hero' | 'about' | 'skills' | 'projects' | 'experience' | 'education' | 'contact' | 'testimonials';
  title: string;
  order: number;
  isVisible: boolean;
  isRequired: boolean;
  config: Record<string, any>;
}

interface TemplateStyling {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: {
      primary: string;
      secondary: string;
      muted: string;
    };
  };
  typography: {
    fontFamily: {
      heading: string;
      body: string;
      mono: string;
    };
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
      '4xl': string;
    };
  };
  spacing: {
    section: string;
    component: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
}

interface TemplateLayout {
  type: 'single-column' | 'two-column' | 'grid' | 'masonry';
  navigation: {
    type: 'top' | 'side' | 'floating';
    position: 'fixed' | 'sticky' | 'static';
  };
  hero: {
    type: 'full-screen' | 'banner' | 'split' | 'minimal';
    backgroundType: 'color' | 'gradient' | 'image' | 'video';
  };
  projects: {
    layout: 'grid' | 'list' | 'masonry' | 'carousel';
    itemsPerRow: number;
    showThumbnails: boolean;
    showTags: boolean;
  };
}

export class PortfolioTemplateSystem {

  /**
   * Get template configuration for a specific template type
   */
  async getTemplateConfig(template: PortfolioTemplate, theme: PortfolioTheme): Promise<TemplateConfig> {
    // Try to get custom template config from database
    const customConfig = await db.portfolioTemplateConfig.findFirst({
      where: {
        templateType: template,
        theme: theme,
        isPublic: true
      }
    });

    if (customConfig) {
      return {
        sections: customConfig.sections as TemplateSection[],
        styling: customConfig.styling as TemplateStyling,
        layout: customConfig.layout as TemplateLayout
      };
    }

    // Return default configuration
    return this.getDefaultTemplateConfig(template, theme);
  }

  /**
   * Get default template configuration based on template and theme
   */
  private getDefaultTemplateConfig(template: PortfolioTemplate, theme: PortfolioTheme): TemplateConfig {
    const baseConfig = this.getBaseTemplateConfig(template);
    const themeStyles = this.getThemeStyles(theme);

    return {
      ...baseConfig,
      styling: {
        ...baseConfig.styling,
        colors: themeStyles.colors
      }
    };
  }

  /**
   * Get base template structure and layout
   */
  private getBaseTemplateConfig(template: PortfolioTemplate): TemplateConfig {
    switch (template) {
      case 'MODERN_TECH':
        return this.getModernTechTemplate();
      case 'CREATIVE_DESIGNER':
        return this.getCreativeDesignerTemplate();
      case 'BUSINESS_PROFESSIONAL':
        return this.getBusinessProfessionalTemplate();
      case 'MARKETING_SPECIALIST':
        return this.getMarketingSpecialistTemplate();
      case 'DATA_SCIENTIST':
        return this.getDataScientistTemplate();
      case 'PRODUCT_MANAGER':
        return this.getProductManagerTemplate();
      case 'CONSULTANT':
        return this.getConsultantTemplate();
      case 'FREELANCER':
        return this.getFreelancerTemplate();
      case 'EXECUTIVE':
        return this.getExecutiveTemplate();
      case 'STARTUP_FOUNDER':
        return this.getStartupFounderTemplate();
      default:
        return this.getModernTechTemplate();
    }
  }

  /**
   * Modern Tech template configuration
   */
  private getModernTechTemplate(): TemplateConfig {
    return {
      sections: [
        {
          id: 'hero',
          type: 'hero',
          title: 'Hero Section',
          order: 0,
          isVisible: true,
          isRequired: true,
          config: {
            showAvatar: true,
            showSocialLinks: true,
            showSkillsOverview: true,
            ctaText: 'View My Work'
          }
        },
        {
          id: 'about',
          type: 'about',
          title: 'About Me',
          order: 1,
          isVisible: true,
          isRequired: false,
          config: {
            showPersonalStatement: true,
            showKeyHighlights: true,
            maxLength: 300
          }
        },
        {
          id: 'skills',
          type: 'skills',
          title: 'Technical Skills',
          order: 2,
          isVisible: true,
          isRequired: false,
          config: {
            displayType: 'grid',
            showProficiencyLevel: true,
            groupByCategory: true,
            maxSkills: 12
          }
        },
        {
          id: 'projects',
          type: 'projects',
          title: 'Featured Projects',
          order: 3,
          isVisible: true,
          isRequired: true,
          config: {
            maxProjects: 6,
            showTechnologies: true,
            showMetrics: true,
            showLinks: true
          }
        },
        {
          id: 'experience',
          type: 'experience',
          title: 'Work Experience',
          order: 4,
          isVisible: true,
          isRequired: false,
          config: {
            showCompanyLogos: true,
            showTimeline: true,
            maxPositions: 5
          }
        },
        {
          id: 'contact',
          type: 'contact',
          title: 'Get In Touch',
          order: 5,
          isVisible: true,
          isRequired: true,
          config: {
            showContactForm: true,
            showSocialLinks: true,
            showCalendarLink: false
          }
        }
      ],
      styling: this.getDefaultStyling(),
      layout: {
        type: 'single-column',
        navigation: {
          type: 'top',
          position: 'sticky'
        },
        hero: {
          type: 'banner',
          backgroundType: 'gradient'
        },
        projects: {
          layout: 'grid',
          itemsPerRow: 2,
          showThumbnails: true,
          showTags: true
        }
      }
    };
  }

  /**
   * Creative Designer template configuration
   */
  private getCreativeDesignerTemplate(): TemplateConfig {
    return {
      sections: [
        {
          id: 'hero',
          type: 'hero',
          title: 'Hero Section',
          order: 0,
          isVisible: true,
          isRequired: true,
          config: {
            showAvatar: true,
            showSocialLinks: true,
            showCreativeStatement: true,
            ctaText: 'Explore My Work'
          }
        },
        {
          id: 'projects',
          type: 'projects',
          title: 'Portfolio',
          order: 1,
          isVisible: true,
          isRequired: true,
          config: {
            maxProjects: 12,
            showThumbnails: true,
            showCaseStudies: true,
            layoutType: 'masonry'
          }
        },
        {
          id: 'about',
          type: 'about',
          title: 'About',
          order: 2,
          isVisible: true,
          isRequired: false,
          config: {
            showPersonalPhoto: true,
            showCreativeProcess: true,
            maxLength: 200
          }
        },
        {
          id: 'skills',
          type: 'skills',
          title: 'Skills & Tools',
          order: 3,
          isVisible: true,
          isRequired: false,
          config: {
            displayType: 'visual',
            showToolLogos: true,
            groupByCategory: true
          }
        },
        {
          id: 'testimonials',
          type: 'testimonials',
          title: 'Client Testimonials',
          order: 4,
          isVisible: true,
          isRequired: false,
          config: {
            maxTestimonials: 3,
            showClientPhotos: true,
            showRatings: true
          }
        },
        {
          id: 'contact',
          type: 'contact',
          title: 'Let\'s Work Together',
          order: 5,
          isVisible: true,
          isRequired: true,
          config: {
            showContactForm: true,
            showAvailability: true,
            showPricing: false
          }
        }
      ],
      styling: this.getDefaultStyling(),
      layout: {
        type: 'masonry',
        navigation: {
          type: 'side',
          position: 'fixed'
        },
        hero: {
          type: 'full-screen',
          backgroundType: 'image'
        },
        projects: {
          layout: 'masonry',
          itemsPerRow: 3,
          showThumbnails: true,
          showTags: false
        }
      }
    };
  }

  /**
   * Business Professional template configuration
   */
  private getBusinessProfessionalTemplate(): TemplateConfig {
    return {
      sections: [
        {
          id: 'hero',
          type: 'hero',
          title: 'Professional Header',
          order: 0,
          isVisible: true,
          isRequired: true,
          config: {
            showProfessionalPhoto: true,
            showCurrentRole: true,
            showCredentials: true,
            ctaText: 'Download Resume'
          }
        },
        {
          id: 'about',
          type: 'about',
          title: 'Executive Summary',
          order: 1,
          isVisible: true,
          isRequired: true,
          config: {
            showKeyAchievements: true,
            showIndustryExperience: true,
            maxLength: 400
          }
        },
        {
          id: 'experience',
          type: 'experience',
          title: 'Professional Experience',
          order: 2,
          isVisible: true,
          isRequired: true,
          config: {
            showCompanyLogos: true,
            showAchievements: true,
            showTimeline: true,
            detailLevel: 'comprehensive'
          }
        },
        {
          id: 'skills',
          type: 'skills',
          title: 'Core Competencies',
          order: 3,
          isVisible: true,
          isRequired: false,
          config: {
            displayType: 'list',
            groupByCategory: true,
            showEndorsements: false
          }
        },
        {
          id: 'education',
          type: 'education',
          title: 'Education & Certifications',
          order: 4,
          isVisible: true,
          isRequired: false,
          config: {
            showDegrees: true,
            showCertifications: true,
            showInstitutionLogos: true
          }
        },
        {
          id: 'contact',
          type: 'contact',
          title: 'Contact Information',
          order: 5,
          isVisible: true,
          isRequired: true,
          config: {
            showLinkedIn: true,
            showEmail: true,
            showPhone: true,
            showContactForm: false
          }
        }
      ],
      styling: this.getDefaultStyling(),
      layout: {
        type: 'two-column',
        navigation: {
          type: 'top',
          position: 'static'
        },
        hero: {
          type: 'minimal',
          backgroundType: 'color'
        },
        projects: {
          layout: 'list',
          itemsPerRow: 1,
          showThumbnails: false,
          showTags: false
        }
      }
    };
  }

  /**
   * Get additional template configurations (placeholder for other templates)
   */
  private getMarketingSpecialistTemplate(): TemplateConfig {
    return this.getModernTechTemplate(); // Extend as needed
  }

  private getDataScientistTemplate(): TemplateConfig {
    return this.getModernTechTemplate(); // Extend as needed
  }

  private getProductManagerTemplate(): TemplateConfig {
    return this.getBusinessProfessionalTemplate(); // Extend as needed
  }

  private getConsultantTemplate(): TemplateConfig {
    return this.getBusinessProfessionalTemplate(); // Extend as needed
  }

  private getFreelancerTemplate(): TemplateConfig {
    return this.getCreativeDesignerTemplate(); // Extend as needed
  }

  private getExecutiveTemplate(): TemplateConfig {
    return this.getBusinessProfessionalTemplate(); // Extend as needed
  }

  private getStartupFounderTemplate(): TemplateConfig {
    return this.getModernTechTemplate(); // Extend as needed
  }

  /**
   * Get theme-specific color schemes
   */
  private getThemeStyles(theme: PortfolioTheme) {
    switch (theme) {
      case 'MINIMAL_LIGHT':
        return {
          colors: {
            primary: '#2563eb',
            secondary: '#64748b',
            accent: '#f59e0b',
            background: '#ffffff',
            surface: '#f8fafc',
            text: {
              primary: '#0f172a',
              secondary: '#475569',
              muted: '#94a3b8'
            }
          }
        };
      case 'MINIMAL_DARK':
        return {
          colors: {
            primary: '#3b82f6',
            secondary: '#64748b',
            accent: '#f59e0b',
            background: '#0f172a',
            surface: '#1e293b',
            text: {
              primary: '#f8fafc',
              secondary: '#cbd5e1',
              muted: '#64748b'
            }
          }
        };
      case 'CREATIVE_COLORFUL':
        return {
          colors: {
            primary: '#8b5cf6',
            secondary: '#ec4899',
            accent: '#10b981',
            background: '#ffffff',
            surface: '#f9fafb',
            text: {
              primary: '#111827',
              secondary: '#374151',
              muted: '#6b7280'
            }
          }
        };
      case 'PROFESSIONAL_BLUE':
        return {
          colors: {
            primary: '#1e40af',
            secondary: '#3730a3',
            accent: '#0891b2',
            background: '#ffffff',
            surface: '#f1f5f9',
            text: {
              primary: '#0f172a',
              secondary: '#334155',
              muted: '#64748b'
            }
          }
        };
      case 'TECH_DARK':
        return {
          colors: {
            primary: '#06b6d4',
            secondary: '#0891b2',
            accent: '#00d9ff',
            background: '#0a0a0a',
            surface: '#1a1a1a',
            text: {
              primary: '#ffffff',
              secondary: '#d1d5db',
              muted: '#9ca3af'
            }
          }
        };
      default:
        return this.getThemeStyles('MINIMAL_LIGHT');
    }
  }

  /**
   * Default styling configuration
   */
  private getDefaultStyling(): TemplateStyling {
    return {
      colors: {
        primary: '#2563eb',
        secondary: '#64748b',
        accent: '#f59e0b',
        background: '#ffffff',
        surface: '#f8fafc',
        text: {
          primary: '#0f172a',
          secondary: '#475569',
          muted: '#94a3b8'
        }
      },
      typography: {
        fontFamily: {
          heading: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          body: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          mono: 'Fira Code, Monaco, "Cascadia Code", "Roboto Mono", monospace'
        },
        fontSize: {
          xs: '0.75rem',
          sm: '0.875rem',
          base: '1rem',
          lg: '1.125rem',
          xl: '1.25rem',
          '2xl': '1.5rem',
          '3xl': '1.875rem',
          '4xl': '2.25rem'
        }
      },
      spacing: {
        section: '4rem',
        component: '2rem'
      },
      borderRadius: {
        sm: '0.125rem',
        md: '0.375rem',
        lg: '0.5rem',
        full: '9999px'
      },
      shadows: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
      }
    };
  }

  /**
   * Create custom template configuration
   */
  async createCustomTemplate(data: {
    name: string;
    description: string;
    category: string;
    templateType: PortfolioTemplate;
    theme: PortfolioTheme;
    sections: TemplateSection[];
    styling: TemplateStyling;
    layout: TemplateLayout;
    isPublic?: boolean;
    isPremium?: boolean;
  }) {
    return db.portfolioTemplateConfig.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        templateType: data.templateType,
        theme: data.theme,
        sections: data.sections as any,
        styling: data.styling as any,
        layout: data.layout as any,
        isPublic: data.isPublic ?? true,
        isPremium: data.isPremium ?? false
      }
    });
  }

  /**
   * Get all available templates
   */
  async getAvailableTemplates() {
    const customTemplates = await db.portfolioTemplateConfig.findMany({
      where: { isPublic: true },
      orderBy: { usageCount: 'desc' }
    });

    const defaultTemplates = [
      { type: 'MODERN_TECH', name: 'Modern Tech', category: 'Technology', description: 'Clean, modern design perfect for developers and tech professionals' },
      { type: 'CREATIVE_DESIGNER', name: 'Creative Designer', category: 'Design', description: 'Visual-first layout ideal for designers and creative professionals' },
      { type: 'BUSINESS_PROFESSIONAL', name: 'Business Professional', category: 'Business', description: 'Professional layout for executives and business leaders' },
      { type: 'MARKETING_SPECIALIST', name: 'Marketing Specialist', category: 'Marketing', description: 'Engaging design for marketing and growth professionals' },
      { type: 'DATA_SCIENTIST', name: 'Data Scientist', category: 'Analytics', description: 'Data-focused layout with emphasis on metrics and analysis' },
      { type: 'PRODUCT_MANAGER', name: 'Product Manager', category: 'Product', description: 'Results-oriented design for product managers and strategists' },
      { type: 'CONSULTANT', name: 'Consultant', category: 'Consulting', description: 'Professional template for consultants and advisors' },
      { type: 'FREELANCER', name: 'Freelancer', category: 'Freelance', description: 'Versatile design perfect for freelancers and independent contractors' },
      { type: 'EXECUTIVE', name: 'Executive', category: 'Leadership', description: 'Executive-level template for C-suite and senior leadership' },
      { type: 'STARTUP_FOUNDER', name: 'Startup Founder', category: 'Entrepreneurship', description: 'Dynamic template for entrepreneurs and startup founders' }
    ];

    return {
      defaultTemplates,
      customTemplates: customTemplates.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        templateType: template.templateType,
        theme: template.theme,
        isPremium: template.isPremium,
        usageCount: template.usageCount,
        previewImageUrl: template.previewImageUrl
      }))
    };
  }
}

export const portfolioTemplateSystem = new PortfolioTemplateSystem();