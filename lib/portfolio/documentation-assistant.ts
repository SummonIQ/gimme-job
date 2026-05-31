import { generateAIText } from '@/lib/ai';
import type { AiProvider } from '@/lib/ai/models';
import { db } from '@/lib/db/client';

interface DocumentationRequest {
  projectId: string;
  projectTitle: string;
  projectDescription?: string;
  technologies: string[];
  githubUrl?: string;
  demoUrl?: string;
  codeSnippets?: Array<{
    language: string;
    code: string;
    description?: string;
  }>;
  existingReadme?: string;
  targetAudience: 'technical' | 'business' | 'general';
  documentationType: 'case-study' | 'readme' | 'technical-doc' | 'presentation';
  aiProvider?: AiProvider;
}

interface GeneratedDocumentation {
  title: string;
  content: string;
  sections: DocumentationSection[];
  summary: string;
  keyTakeaways: string[];
  technicalHighlights: string[];
  businessImpact?: string;
}

interface DocumentationSection {
  id: string;
  title: string;
  content: string;
  order: number;
  type: 'overview' | 'problem' | 'solution' | 'implementation' | 'results' | 'technical' | 'media';
}

export class ProjectDocumentationAssistant {

  /**
   * Generate comprehensive project documentation
   */
  async generateDocumentation(request: DocumentationRequest): Promise<GeneratedDocumentation> {
    const prompt = this.buildDocumentationPrompt(request);

    try {
      const response = await generateAIText(prompt, {
        aiProvider: request.aiProvider,
        tier: 'strong',
        system: this.getSystemPrompt(
          request.documentationType,
          request.targetAudience,
        ),
        temperature: 0.7,
      });

      if (!response) {
        throw new Error('Failed to generate documentation');
      }

      // Parse and structure the response
      const documentation = this.parseDocumentationResponse(response, request);

      // Store generated documentation
      await this.storeDocumentation(request.projectId, documentation);

      return documentation;

    } catch (error) {
      console.error('Documentation generation failed:', error);
      throw new Error(`Failed to generate documentation: ${error.message}`);
    }
  }

  /**
   * Generate case study for a project
   */
  async generateCaseStudy(request: Omit<DocumentationRequest, 'documentationType'>) {
    return this.generateDocumentation({
      ...request,
      documentationType: 'case-study'
    });
  }

  /**
   * Generate README for a project
   */
  async generateReadme(request: Omit<DocumentationRequest, 'documentationType'>) {
    return this.generateDocumentation({
      ...request,
      documentationType: 'readme'
    });
  }

  /**
   * Generate technical documentation
   */
  async generateTechnicalDoc(request: Omit<DocumentationRequest, 'documentationType'>) {
    return this.generateDocumentation({
      ...request,
      documentationType: 'technical-doc',
      targetAudience: 'technical'
    });
  }

  /**
   * Enhance existing project with documentation
   */
  async enhanceProjectDocumentation(projectId: string, options?: {
    includeCodeAnalysis?: boolean;
    generateCaseStudy?: boolean;
    targetAudience?: 'technical' | 'business' | 'general';
  }) {
    const project = await db.portfolioProject.findUnique({
      where: { id: projectId },
      include: {
        codeSnippets: true,
        documentationAssets: true
      }
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const request: DocumentationRequest = {
      projectId,
      projectTitle: project.title,
      projectDescription: project.description,
      technologies: project.technologies,
      githubUrl: project.githubUrl || undefined,
      demoUrl: project.demoUrl || undefined,
      codeSnippets: project.codeSnippets.map(snippet => ({
        language: snippet.language,
        code: snippet.code,
        description: snippet.description || undefined
      })),
      targetAudience: options?.targetAudience || 'general',
      documentationType: options?.generateCaseStudy ? 'case-study' : 'readme'
    };

    // Fetch README from GitHub if available
    if (project.githubUrl && options?.includeCodeAnalysis) {
      try {
        const readme = await this.fetchReadmeFromGitHub(project.githubUrl);
        if (readme) {
          request.existingReadme = readme;
        }
      } catch (error) {
        console.error('Failed to fetch README:', error);
      }
    }

    const documentation = await this.generateDocumentation(request);

    // Update project with generated content
    const updatedProject = await db.portfolioProject.update({
      where: { id: projectId },
      data: {
        longDescription: documentation.content,
        challenges: this.extractSection(documentation.sections, 'problem'),
        solutions: this.extractSection(documentation.sections, 'solution'),
        impact: documentation.businessImpact,
        caseStudyGenerated: options?.generateCaseStudy || false
      }
    });

    return {
      project: updatedProject,
      documentation
    };
  }

  /**
   * Build prompt for documentation generation
   */
  private buildDocumentationPrompt(request: DocumentationRequest): string {
    const sections = [];

    sections.push(`Project Information:
    - Title: ${request.projectTitle}
    - Description: ${request.projectDescription || 'Not provided'}
    - Technologies: ${request.technologies.join(', ')}`);

    if (request.githubUrl) {
      sections.push(`- GitHub URL: ${request.githubUrl}`);
    }

    if (request.demoUrl) {
      sections.push(`- Demo URL: ${request.demoUrl}`);
    }

    if (request.existingReadme) {
      sections.push(`Existing README Content:
      ${request.existingReadme.substring(0, 1000)}${request.existingReadme.length > 1000 ? '...' : ''}`);
    }

    if (request.codeSnippets && request.codeSnippets.length > 0) {
      sections.push(`Code Snippets:
      ${request.codeSnippets.map((snippet, index) =>
        `${index + 1}. ${snippet.language}${snippet.description ? ` - ${snippet.description}` : ''}:\n${snippet.code.substring(0, 300)}...`
      ).join('\n\n')}`);
    }

    sections.push(`Documentation Requirements:
    - Type: ${request.documentationType}
    - Target Audience: ${request.targetAudience}
    - Focus on practical value and real-world impact
    - Include technical details appropriate for the audience
    - Highlight unique aspects and problem-solving approach`);

    return sections.join('\n\n');
  }

  /**
   * Get system prompt based on documentation type
   */
  private getSystemPrompt(type: string, audience: string): string {
    const basePrompt = `You are an expert technical writer and project documentation specialist. You create engaging, comprehensive documentation that showcases projects effectively for portfolios.`;

    switch (type) {
      case 'case-study':
        return `${basePrompt}

        Create a compelling case study that follows this structure:
        1. **Project Overview** - What was built and why
        2. **Problem Statement** - What challenges were addressed
        3. **Solution Approach** - How the problem was solved
        4. **Implementation Details** - Technical implementation highlights
        5. **Results & Impact** - Outcomes and metrics
        6. **Key Learnings** - What was learned and future improvements

        Write for ${audience} audience. Use engaging storytelling while maintaining technical accuracy.

        Format your response as structured JSON with this schema:
        {
          "title": "Case Study Title",
          "summary": "2-3 sentence summary",
          "sections": [
            {
              "id": "section_id",
              "title": "Section Title",
              "content": "Section content",
              "order": 0,
              "type": "overview|problem|solution|implementation|results|technical"
            }
          ],
          "keyTakeaways": ["takeaway1", "takeaway2"],
          "technicalHighlights": ["highlight1", "highlight2"],
          "businessImpact": "Business impact description"
        }`;

      case 'readme':
        return `${basePrompt}

        Create a comprehensive README that includes:
        1. **Project Description** - Clear, concise overview
        2. **Features** - Key functionality and capabilities
        3. **Technology Stack** - Technologies and frameworks used
        4. **Installation/Setup** - How to get started
        5. **Usage** - How to use the project
        6. **Contributing** - How others can contribute
        7. **Future Enhancements** - Planned improvements

        Write for ${audience} audience with clear, actionable content.`;

      case 'technical-doc':
        return `${basePrompt}

        Create detailed technical documentation that covers:
        1. **Architecture Overview** - System design and structure
        2. **Technical Specifications** - Detailed technical requirements
        3. **Implementation Details** - Code architecture and patterns
        4. **API Documentation** - Endpoints and usage
        5. **Performance Considerations** - Optimization and scalability
        6. **Security Measures** - Security implementation
        7. **Maintenance Guide** - Ongoing maintenance requirements

        Write for technical professionals with detailed implementation insights.`;

      default:
        return basePrompt;
    }
  }

  /**
   * Parse AI response into structured documentation
   */
  private parseDocumentationResponse(response: string, request: DocumentationRequest): GeneratedDocumentation {
    try {
      // Try to parse JSON response
      const parsed = JSON.parse(response);

      return {
        title: parsed.title || `${request.projectTitle} - ${request.documentationType}`,
        content: this.sectionsToMarkdown(parsed.sections || []),
        sections: parsed.sections || [],
        summary: parsed.summary || '',
        keyTakeaways: parsed.keyTakeaways || [],
        technicalHighlights: parsed.technicalHighlights || [],
        businessImpact: parsed.businessImpact
      };
    } catch (error) {
      // Fallback: treat response as plain text and create basic structure
      return {
        title: `${request.projectTitle} Documentation`,
        content: response,
        sections: [
          {
            id: 'overview',
            title: 'Overview',
            content: response,
            order: 0,
            type: 'overview'
          }
        ],
        summary: response.substring(0, 200) + '...',
        keyTakeaways: [],
        technicalHighlights: request.technologies,
        businessImpact: undefined
      };
    }
  }

  /**
   * Convert sections array to markdown
   */
  private sectionsToMarkdown(sections: DocumentationSection[]): string {
    return sections
      .sort((a, b) => a.order - b.order)
      .map(section => `## ${section.title}\n\n${section.content}`)
      .join('\n\n');
  }

  /**
   * Extract specific section content
   */
  private extractSection(sections: DocumentationSection[], type: string): string | null {
    const section = sections.find(s => s.type === type);
    return section ? section.content : null;
  }

  /**
   * Store generated documentation in database
   */
  private async storeDocumentation(projectId: string, documentation: GeneratedDocumentation) {
    // Store as project documentation asset
    await db.projectDocumentationAsset.create({
      data: {
        projectId,
        fileName: 'generated-documentation.md',
        originalFileName: 'Generated Documentation',
        fileType: 'document',
        fileUrl: '', // Would be stored in file system/cloud storage
        description: documentation.summary,
        order: 0
      }
    });

    // Could also store in a separate documentation table if needed
  }

  /**
   * Fetch README from GitHub URL (simplified implementation)
   */
  private async fetchReadmeFromGitHub(githubUrl: string): Promise<string | null> {
    try {
      // Extract repo info from URL
      const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) return null;

      const [, owner, repo] = match;
      const response = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`);

      if (response.ok) {
        return await response.text();
      }

      // Try alternative README locations
      const altResponse = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`);
      return altResponse.ok ? await altResponse.text() : null;
    } catch (error) {
      console.error('Failed to fetch README from GitHub:', error);
      return null;
    }
  }

  /**
   * Generate code explanations for snippets
   */
  async generateCodeExplanation(
    codeSnippet: string,
    language: string,
    context?: string,
    options: { readonly aiProvider?: AiProvider } = {},
  ): Promise<string> {
    try {
      const text = await generateAIText(
        `Explain this ${language} code snippet for a portfolio context:

${context ? `Context: ${context}\n\n` : ''}Code:
\`\`\`${language}
${codeSnippet}
\`\`\`

Provide a clear, professional explanation that highlights the technical skills and problem-solving approach demonstrated.`,
        {
          aiProvider: options.aiProvider,
          tier: 'fast',
          system:
            'You are a technical documentation expert. Explain code clearly for portfolio showcases, highlighting the key concepts, patterns, and value demonstrated.',
          temperature: 0.7,
        },
      );

      return text || 'Code explanation not available.';
    } catch (error) {
      console.error('Failed to generate code explanation:', error);
      return 'Code explanation not available.';
    }
  }
}

export const documentationAssistant = new ProjectDocumentationAssistant();