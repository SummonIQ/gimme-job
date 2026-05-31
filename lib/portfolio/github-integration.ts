import { generateAIText } from '@/lib/ai';
import type { AiProvider } from '@/lib/ai/models';
import { db } from '@/lib/db/client';

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  topics: string[];
  created_at: string;
  updated_at: string;
  pushed_at: string;
  private: boolean;
}

interface GitHubContents {
  name: string;
  path: string;
  content?: string;
  encoding?: string;
}

export class GitHubPortfolioIntegration {
  private readonly aiProvider?: AiProvider;

  constructor(options: { readonly aiProvider?: AiProvider } = {}) {
    this.aiProvider = options.aiProvider;
  }

  /**
   * Sync GitHub repositories to portfolio projects
   */
  async syncRepositories(userId: string) {
    const integration = await db.gitHubIntegration.findUnique({
      where: { userId },
      include: { githubProjects: true }
    });

    if (!integration || !integration.isActive) {
      throw new Error('GitHub integration not found or inactive');
    }

    try {
      const repos = await this.fetchUserRepositories(integration.accessToken);
      const syncedProjects = [];

      for (const repo of repos) {
        // Skip if excluded or private (and user doesn't want private repos)
        if (integration.excludedRepos.includes(repo.full_name) ||
            (repo.private && !integration.syncPrivateRepos)) {
          continue;
        }

        // Update or create GitHub project record
        const githubProject = await this.syncGitHubProject(integration.id, repo);

        // If marked for portfolio inclusion, create/update portfolio project
        if (githubProject.isIncludedInPortfolio) {
          const portfolioProject = await this.createPortfolioProjectFromRepo(userId, githubProject, repo);
          syncedProjects.push(portfolioProject);
        }
      }

      // Update last sync time
      await db.gitHubIntegration.update({
        where: { id: integration.id },
        data: { lastSyncAt: new Date() }
      });

      return {
        syncedCount: syncedProjects.length,
        totalRepos: repos.length,
        projects: syncedProjects
      };

    } catch (error) {
      console.error('GitHub sync failed:', error);
      throw new Error(`Failed to sync GitHub repositories: ${error.message}`);
    }
  }

  /**
   * Fetch repositories from GitHub API
   */
  private async fetchUserRepositories(accessToken: string): Promise<GitHubRepo[]> {
    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
      headers: {
        'Authorization': `token ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Sync individual GitHub project
   */
  private async syncGitHubProject(integrationId: string, repo: GitHubRepo) {
    // Detect technologies from repository
    const technologies = await this.detectTechnologies(repo);

    // Generate AI description if needed
    let aiDescription = null;
    if (!repo.description || repo.description.length < 50) {
      aiDescription = await this.generateProjectDescription(repo, technologies);
    }

    return db.gitHubProject.upsert({
      where: {
        integrationId_repoFullName: {
          integrationId,
          repoFullName: repo.full_name
        }
      },
      update: {
        repoName: repo.name,
        description: repo.description,
        language: repo.language,
        topics: repo.topics,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        isPrivate: repo.private,
        htmlUrl: repo.html_url,
        apiUrl: `https://api.github.com/repos/${repo.full_name}`,
        technologies,
        aiGeneratedDescription: aiDescription,
        lastCommitAt: new Date(repo.pushed_at),
        syncedAt: new Date()
      },
      create: {
        integrationId,
        repoName: repo.name,
        repoFullName: repo.full_name,
        description: repo.description,
        language: repo.language,
        topics: repo.topics,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        isPrivate: repo.private,
        htmlUrl: repo.html_url,
        apiUrl: `https://api.github.com/repos/${repo.full_name}`,
        technologies,
        aiGeneratedDescription: aiDescription,
        lastCommitAt: new Date(repo.pushed_at),
        createdAt: new Date(repo.created_at),
        isIncludedInPortfolio: true // Default to include
      }
    });
  }

  /**
   * Detect technologies from repository
   */
  private async detectTechnologies(repo: GitHubRepo): Promise<string[]> {
    const technologies: string[] = [];

    // Add primary language
    if (repo.language) {
      technologies.push(repo.language);
    }

    // Add technologies from topics
    const techTopics = repo.topics.filter(topic =>
      ['javascript', 'typescript', 'react', 'nodejs', 'python', 'java', 'cpp', 'csharp',
       'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'dart', 'flutter', 'vue', 'angular',
       'nextjs', 'express', 'django', 'flask', 'spring', 'docker', 'kubernetes', 'aws',
       'gcp', 'azure', 'postgresql', 'mongodb', 'redis', 'graphql', 'rest-api'].includes(topic)
    );

    technologies.push(...techTopics);

    return [...new Set(technologies)]; // Remove duplicates
  }

  /**
   * Generate AI-powered project description
   */
  private async generateProjectDescription(repo: GitHubRepo, technologies: string[]): Promise<string> {
    try {
      const text = await generateAIText(
        `Project: ${repo.name}
Description: ${repo.description || 'No description provided'}
Language: ${repo.language}
Technologies: ${technologies.join(', ')}
Topics: ${repo.topics.join(', ')}
Stars: ${repo.stargazers_count}

Create a compelling portfolio description for this project that would interest potential employers.`,
        {
          aiProvider: this.aiProvider,
          tier: 'fast',
          system:
            "You are a technical writer who creates engaging project descriptions for developer portfolios. Write 1-2 sentences that highlight the project's purpose and technical value.",
          temperature: 0.7,
        },
      );

      return (
        text?.trim() ||
        'A well-crafted project showcasing modern development practices and technical expertise.'
      );
    } catch (error) {
      console.error('Failed to generate AI description:', error);
      return 'A well-crafted project showcasing modern development practices and technical expertise.';
    }
  }

  /**
   * Create portfolio project from GitHub repository
   */
  private async createPortfolioProjectFromRepo(userId: string, githubProject: any, repo: GitHubRepo) {
    // Get user's default portfolio
    let portfolio = await db.portfolio.findFirst({
      where: { userId, isDefault: true }
    });

    // Create default portfolio if none exists
    if (!portfolio) {
      portfolio = await db.portfolio.create({
        data: {
          userId,
          title: 'My Portfolio',
          slug: `portfolio-${Date.now()}`,
          template: 'MODERN_TECH',
          theme: 'MINIMAL_LIGHT',
          isDefault: true
        }
      });
    }

    // Check if portfolio project already exists
    const existingProject = await db.portfolioProject.findFirst({
      where: {
        portfolioId: portfolio.id,
        githubUrl: repo.html_url
      }
    });

    if (existingProject) {
      // Update existing project
      return db.portfolioProject.update({
        where: { id: existingProject.id },
        data: {
          title: repo.name.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          description: githubProject.aiGeneratedDescription || repo.description || 'No description available',
          shortDescription: (githubProject.aiGeneratedDescription || repo.description || '').substring(0, 100) + (repo.description && repo.description.length > 100 ? '...' : ''),
          technologies: githubProject.technologies,
          tags: repo.topics,
          metrics: JSON.stringify({
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            language: repo.language,
            lastCommit: repo.pushed_at
          }),
          aiEnhanced: !!githubProject.aiGeneratedDescription
        }
      });
    }

    // Create new portfolio project
    const projectOrder = await db.portfolioProject.count({
      where: { portfolioId: portfolio.id }
    });

    return db.portfolioProject.create({
      data: {
        portfolioId: portfolio.id,
        title: repo.name.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        description: githubProject.aiGeneratedDescription || repo.description || 'A software project showcasing technical skills and innovative solutions.',
        shortDescription: (githubProject.aiGeneratedDescription || repo.description || 'A software project showcasing technical skills.').substring(0, 100) + '...',
        type: 'CODE_PROJECT',
        status: 'PUBLISHED',
        slug: repo.name,
        order: projectOrder,
        technologies: githubProject.technologies,
        tags: repo.topics,
        githubUrl: repo.html_url,
        startDate: new Date(repo.created_at),
        metrics: JSON.stringify({
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          language: repo.language,
          lastCommit: repo.pushed_at
        }),
        aiEnhanced: !!githubProject.aiGeneratedDescription
      }
    });
  }

  /**
   * Fetch and enhance project with README content
   */
  async enhanceProjectWithReadme(projectId: string) {
    const project = await db.portfolioProject.findUnique({
      where: { id: projectId },
      include: {
        portfolio: {
          include: {
            user: {
              include: {
                githubIntegration: true
              }
            }
          }
        }
      }
    });

    if (!project || !project.githubUrl || !project.portfolio.user.githubIntegration) {
      throw new Error('Project or GitHub integration not found');
    }

    // Extract repo info from GitHub URL
    const repoMatch = project.githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!repoMatch) {
      throw new Error('Invalid GitHub URL');
    }

    const [, owner, repo] = repoMatch;
    const integration = project.portfolio.user.githubIntegration;

    try {
      // Fetch README
      const readme = await this.fetchReadme(integration.accessToken, owner, repo);

      if (readme) {
        // Generate enhanced description from README
        const enhancedDescription = await this.generateDescriptionFromReadme(readme, project.title);

        // Update project with enhanced content
        return db.portfolioProject.update({
          where: { id: projectId },
          data: {
            longDescription: enhancedDescription,
            aiEnhanced: true
          }
        });
      }
    } catch (error) {
      console.error('Failed to enhance project with README:', error);
      throw error;
    }
  }

  /**
   * Fetch README from GitHub repository
   */
  private async fetchReadme(accessToken: string, owner: string, repo: string): Promise<string | null> {
    const readmeFiles = ['README.md', 'readme.md', 'README.txt', 'README'];

    for (const filename of readmeFiles) {
      try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filename}`, {
          headers: {
            'Authorization': `token ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });

        if (response.ok) {
          const data: GitHubContents = await response.json();
          if (data.content && data.encoding === 'base64') {
            return Buffer.from(data.content, 'base64').toString('utf8');
          }
        }
      } catch (error) {
        continue; // Try next filename
      }
    }

    return null;
  }

  /**
   * Generate enhanced description from README content
   */
  private async generateDescriptionFromReadme(readme: string, projectTitle: string): Promise<string> {
    try {
      const text = await generateAIText(
        `Project: ${projectTitle}

README Content:
${readme.substring(0, 2000)}

Create a compelling portfolio description that highlights:
1. What the project does
2. Key technologies used
3. Notable features or achievements
4. Value proposition

Keep it professional and engaging for potential employers.`,
        {
          aiProvider: this.aiProvider,
          tier: 'fast',
          system:
            'You are a technical writer who creates compelling project descriptions for portfolios. Extract the key features, technologies, and value proposition from the README content and create a 3-4 sentence portfolio description.',
          temperature: 0.7,
        },
      );

      return (
        text?.trim() ||
        'A well-documented project demonstrating strong development practices and technical expertise.'
      );
    } catch (error) {
      console.error('Failed to generate description from README:', error);
      return 'A well-documented project demonstrating strong development practices and technical expertise.';
    }
  }

  /**
   * Update GitHub integration settings
   */
  async updateIntegrationSettings(userId: string, settings: {
    autoSyncRepos?: boolean;
    syncPrivateRepos?: boolean;
    excludedRepos?: string[];
  }) {
    return db.gitHubIntegration.update({
      where: { userId },
      data: {
        ...settings,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Toggle project inclusion in portfolio
   */
  async toggleProjectInclusion(githubProjectId: string, includeInPortfolio: boolean) {
    return db.gitHubProject.update({
      where: { id: githubProjectId },
      data: { isIncludedInPortfolio: includeInPortfolio }
    });
  }
}

export const githubPortfolioIntegration = new GitHubPortfolioIntegration();

export function createGitHubPortfolioIntegration(
  options: { readonly aiProvider?: AiProvider } = {},
): GitHubPortfolioIntegration {
  return new GitHubPortfolioIntegration(options);
}