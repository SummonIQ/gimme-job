import { db } from '@/lib/db/client';
import { generateAIText } from '@/lib/ai';
import type { AiProvider } from '@/lib/ai/models';
import type {
  Portfolio,
  PortfolioProject,
  PortfolioTemplate,
  PortfolioTheme,
  ProjectType,
  User,
  Resume
} from '@/generated/prisma/browser';

interface GeneratePortfolioOptions {
  userId: string;
  template?: PortfolioTemplate;
  theme?: PortfolioTheme;
  includeResume?: boolean;
  includeGithubProjects?: boolean;
  targetRole?: string;
  industry?: string;
  personalStatement?: string;
  selectedSkills?: string[];
  aiProvider?: AiProvider;
}

interface PortfolioGenerationResult {
  portfolio: Portfolio;
  generatedProjects: PortfolioProject[];
  aiEnhancedContent: {
    personalStatement: string;
    skillsHighlight: string[];
    seoTitle: string;
    seoDescription: string;
    projectDescriptions: Record<string, string>;
  };
}

export class PortfolioGenerator {

  /**
   * Generate a complete AI-powered portfolio for a user
   */
  async generatePortfolio(options: GeneratePortfolioOptions): Promise<PortfolioGenerationResult> {
    const {
      userId,
      template = 'MODERN_TECH',
      theme = 'MINIMAL_LIGHT',
      includeResume = true,
      includeGithubProjects = true,
      targetRole,
      industry,
      personalStatement,
      selectedSkills = [],
      aiProvider,
    } = options;

    // Gather user data for AI analysis
    const userData = await this.gatherUserData(userId, includeResume, includeGithubProjects);

    // Generate AI-enhanced content
    const aiContent = await this.generateAIContent(userData, {
      targetRole,
      industry,
      personalStatement,
      selectedSkills,
      template,
      aiProvider,
    });

    // Create the portfolio
    const portfolio = await this.createPortfolio(userId, {
      template,
      theme,
      aiContent
    });

    // Generate and create projects
    const generatedProjects = await this.generateProjects(
      portfolio.id,
      userData,
      aiContent,
      aiProvider,
    );

    return {
      portfolio,
      generatedProjects,
      aiEnhancedContent: aiContent
    };
  }

  /**
   * Gather comprehensive user data for portfolio generation
   */
  private async gatherUserData(userId: string, includeResume: boolean, includeGithub: boolean) {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        resumes: includeResume ? {
          include: {
            revisions: {
              orderBy: { createdAt: 'desc' },
              take: 1
            },
            analysis: true
          },
          orderBy: { updatedAt: 'desc' },
          take: 1
        } : false,
        githubIntegration: includeGithub ? {
          include: {
            githubProjects: {
              where: { isIncludedInPortfolio: true },
              orderBy: { stars: 'desc' }
            }
          }
        } : false,
        jobLeads: {
          include: {
            jobListing: true
          },
          orderBy: { createdAt: 'desc' },
          take: 10 // Recent applications for context
        },
        skillGapAnalyses: {
          orderBy: { createdAt: 'desc' },
          take: 3 // Recent skill analyses
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Generate AI-enhanced content for the portfolio
   */
  private async generateAIContent(userData: any, context: {
    targetRole?: string;
    industry?: string;
    personalStatement?: string;
    selectedSkills: string[];
    template: PortfolioTemplate;
    aiProvider?: AiProvider;
  }) {
    const prompt = this.buildAIPrompt(userData, context);

    const content = await generateAIText(prompt, {
      aiProvider: context.aiProvider,
      tier: 'strong',
      system: `You are an expert portfolio and personal branding consultant. You help professionals create compelling portfolios that showcase their skills, experience, and potential.

Your task is to generate engaging, professional content for a portfolio based on the user's background, resume, projects, and career goals.

Return your response as a JSON object with the following structure:
{
  "personalStatement": "2-3 paragraph engaging personal statement",
  "skillsHighlight": ["top 6-8 skills relevant to target role"],
  "seoTitle": "SEO-optimized title for the portfolio",
  "seoDescription": "160-character SEO description",
  "projectDescriptions": {
    "project_key": "Enhanced description for each project"
  },
  "seoKeywords": ["relevant", "seo", "keywords"]
}`,
      temperature: 0.7,
    });

    if (!content) {
      throw new Error('Failed to generate AI content');
    }

    try {
      const jsonText = content
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '');
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      // Fallback to default content
      return this.getDefaultContent(userData, context);
    }
  }

  /**
   * Build comprehensive prompt for AI content generation
   */
  private buildAIPrompt(userData: any, context: any): string {
    const sections = [];

    // User basic info
    sections.push(`User Profile:
    - Name: ${userData.firstName} ${userData.lastName}
    - Email: ${userData.email}
    - Target Role: ${context.targetRole || 'Not specified'}
    - Industry: ${context.industry || 'Technology'}
    - Template Style: ${context.template}`);

    // Resume information
    if (userData.resumes?.[0]) {
      const resume = userData.resumes[0];
      sections.push(`Resume Information:
      - Latest Resume: ${resume.name}
      - Description: ${resume.description || 'No description'}
      - Analysis Available: ${resume.analysis ? 'Yes' : 'No'}`);
    }

    // GitHub projects
    if (userData.githubIntegration?.githubProjects?.length > 0) {
      const projects = userData.githubIntegration.githubProjects;
      sections.push(`GitHub Projects:
      ${projects.map((p: any) => `- ${p.repoName}: ${p.description || 'No description'} (${p.language || 'Unknown language'}, ${p.stars} stars)`).join('\n')}`);
    }

    // Recent job applications for context
    if (userData.jobLeads?.length > 0) {
      const roles = userData.jobLeads.map((lead: any) => lead.title).slice(0, 5);
      sections.push(`Recent Job Applications: ${roles.join(', ')}`);
    }

    // Skills from analysis
    if (userData.skillGapAnalyses?.length > 0) {
      const skills = userData.skillGapAnalyses
        .flatMap((analysis: any) => JSON.parse(analysis.matchedSkills || '[]'))
        .slice(0, 10);
      sections.push(`Identified Skills: ${skills.join(', ')}`);
    }

    // User preferences
    if (context.personalStatement) {
      sections.push(`User's Personal Statement: ${context.personalStatement}`);
    }

    if (context.selectedSkills.length > 0) {
      sections.push(`User's Selected Skills: ${context.selectedSkills.join(', ')}`);
    }

    sections.push(`Portfolio Requirements:
    - Create content that matches the ${context.template} template style
    - Target ${context.targetRole || 'technology professional'} role in ${context.industry || 'technology'} industry
    - Make the portfolio compelling to recruiters and hiring managers
    - Highlight unique value proposition and key achievements
    - Ensure professional yet personable tone
    - Include relevant SEO optimization for discoverability`);

    return sections.join('\n\n');
  }

  /**
   * Fallback content if AI generation fails
   */
  private getDefaultContent(userData: any, context: any) {
    return {
      personalStatement: `I'm ${userData.firstName} ${userData.lastName}, a passionate ${context.targetRole || 'professional'} with experience in ${context.industry || 'technology'}. I enjoy building innovative solutions and contributing to impactful projects.`,
      skillsHighlight: context.selectedSkills.length > 0 ? context.selectedSkills.slice(0, 8) : ['JavaScript', 'React', 'Node.js', 'TypeScript', 'Python', 'SQL'],
      seoTitle: `${userData.firstName} ${userData.lastName} - ${context.targetRole || 'Software Developer'} Portfolio`,
      seoDescription: `Explore ${userData.firstName} ${userData.lastName}'s portfolio showcasing projects in ${context.industry || 'software development'} and technical expertise.`,
      projectDescriptions: {},
      seoKeywords: [context.targetRole || 'software developer', context.industry || 'technology', 'portfolio', 'projects']
    };
  }

  /**
   * Create the portfolio record in database
   */
  private async createPortfolio(userId: string, options: {
    template: PortfolioTemplate;
    theme: PortfolioTheme;
    aiContent: any;
  }) {
    const slug = await this.generateUniqueSlug(userId);

    return db.portfolio.create({
      data: {
        userId,
        title: `${options.aiContent.seoTitle || 'My Portfolio'}`,
        description: options.aiContent.personalStatement?.substring(0, 200) || undefined,
        slug,
        template: options.template,
        theme: options.theme,
        personalStatement: options.aiContent.personalStatement,
        skillsHighlight: options.aiContent.skillsHighlight || [],
        seoTitle: options.aiContent.seoTitle,
        seoDescription: options.aiContent.seoDescription,
        seoKeywords: options.aiContent.seoKeywords || [],
        status: 'DRAFT',
        isDefault: true
      }
    });
  }

  /**
   * Generate projects for the portfolio
   */
  private async generateProjects(
    portfolioId: string,
    userData: any,
    aiContent: any,
    aiProvider?: AiProvider,
  ): Promise<PortfolioProject[]> {
    const projects: any[] = [];
    let order = 0;

    // Add GitHub projects
    if (userData.githubIntegration?.githubProjects) {
      for (const repo of userData.githubIntegration.githubProjects.slice(0, 6)) {
        const enhancedDescription = aiContent.projectDescriptions?.[repo.repoName] ||
          await this.enhanceProjectDescription(repo, userData, aiProvider);

        projects.push({
          portfolioId,
          title: repo.repoName.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          description: enhancedDescription,
          shortDescription: repo.description || enhancedDescription.substring(0, 100) + '...',
          type: 'CODE_PROJECT' as ProjectType,
          status: 'PUBLISHED',
          slug: repo.repoName,
          order: order++,
          technologies: repo.technologies || [repo.language].filter(Boolean),
          tags: repo.topics || [],
          githubUrl: repo.htmlUrl,
          metrics: JSON.stringify({
            stars: repo.stars,
            forks: repo.forks,
            language: repo.language
          }),
          aiEnhanced: true
        });
      }
    }

    // Create projects in database
    const createdProjects = await Promise.all(
      projects.map(project => db.portfolioProject.create({ data: project }))
    );

    return createdProjects;
  }

  /**
   * Generate unique slug for portfolio
   */
  private async generateUniqueSlug(userId: string): Promise<string> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    let baseSlug = `${user.firstName}-${user.lastName}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    let slug = baseSlug;
    let counter = 1;

    // Check if slug exists
    while (await db.portfolio.findFirst({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Enhance project description using AI
   */
  private async enhanceProjectDescription(
    repo: any,
    userData: any,
    aiProvider?: AiProvider,
  ): Promise<string> {
    try {
      const text = await generateAIText(
        `Project: ${repo.repoName}
Description: ${repo.description || 'No description provided'}
Language: ${repo.language}
Topics: ${repo.topics?.join(', ') || 'None'}
Stars: ${repo.stars}

Create an engaging portfolio description for this project.`,
        {
          aiProvider,
          tier: 'fast',
          system:
            "You are a technical writer who creates engaging project descriptions for portfolios. Write a 2-3 sentence professional description that highlights the project's value and technical aspects.",
          temperature: 0.7,
        },
      );

      return text || repo.description || 'An innovative project showcasing technical expertise.';
    } catch (error) {
      console.error('Failed to enhance project description:', error);
      return repo.description || 'An innovative project showcasing technical expertise.';
    }
  }

  /**
   * Update existing portfolio with AI enhancements
   */
  async enhanceExistingPortfolio(portfolioId: string, options: Partial<GeneratePortfolioOptions> = {}) {
    const portfolio = await db.portfolio.findUnique({
      where: { id: portfolioId },
      include: {
        user: { include: { profile: true } },
        projects: true
      }
    });

    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    const userData = await this.gatherUserData(portfolio.userId, true, true);

    const aiContent = await this.generateAIContent(userData, {
      targetRole: options.targetRole,
      industry: options.industry,
      personalStatement: options.personalStatement,
      selectedSkills: options.selectedSkills || [],
      template: portfolio.template,
      aiProvider: options.aiProvider,
    });

    // Update portfolio with AI content
    const updatedPortfolio = await db.portfolio.update({
      where: { id: portfolioId },
      data: {
        personalStatement: aiContent.personalStatement,
        skillsHighlight: aiContent.skillsHighlight,
        seoTitle: aiContent.seoTitle,
        seoDescription: aiContent.seoDescription,
        seoKeywords: aiContent.seoKeywords
      }
    });

    // Enhance existing projects
    for (const project of portfolio.projects) {
      if (aiContent.projectDescriptions[project.slug]) {
        await db.portfolioProject.update({
          where: { id: project.id },
          data: {
            description: aiContent.projectDescriptions[project.slug],
            aiEnhanced: true
          }
        });
      }
    }

    return updatedPortfolio;
  }
}

export const portfolioGenerator = new PortfolioGenerator();