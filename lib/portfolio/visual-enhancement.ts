import { generateAIText, generateVisionText } from '@/lib/ai';
import type { AiProvider } from '@/lib/ai/models';
import { db } from '@/lib/db/client';

interface ImageEnhancementRequest {
  projectId: string;
  imageUrl: string;
  imageType: 'screenshot' | 'logo' | 'diagram' | 'mockup' | 'photo';
  generateAltText?: boolean;
  generateCaption?: boolean;
  optimizeForPortfolio?: boolean;
}

interface VisualContentSuggestion {
  type: 'screenshot' | 'diagram' | 'flowchart' | 'mockup' | 'video' | 'gif';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
}

interface ProjectVisualAudit {
  projectId: string;
  currentAssets: Array<{
    type: string;
    url: string;
    description?: string;
    altText?: string;
  }>;
  suggestions: VisualContentSuggestion[];
  missingAssets: string[];
  improvementRecommendations: string[];
}

export class VisualContentEnhancer {
  private readonly aiProvider?: AiProvider;

  constructor(options: { readonly aiProvider?: AiProvider } = {}) {
    this.aiProvider = options.aiProvider;
  }

  /**
   * Generate alt text for images using AI vision
   */
  async generateAltText(imageUrl: string, context?: string): Promise<string> {
    try {
      const text = await generateVisionText({
        aiProvider: this.aiProvider,
        imageUrl,
        maxTokens: 150,
        model: 'fast',
        systemPrompt:
          'You are an accessibility expert who creates descriptive alt text for images in professional portfolios. Create clear, concise alt text that describes the visual content and its purpose in the context of a portfolio project.',
        temperature: 0.3,
        userText: `Generate alt text for this image in a portfolio context.${context ? ` Context: ${context}` : ''} Keep it descriptive but concise (under 125 characters).`,
      });

      return (
        text?.trim() ||
        'Portfolio project image showing technical implementation'
      );
    } catch (error) {
      console.error('Failed to generate alt text:', error);
      return 'Portfolio project image';
    }
  }

  /**
   * Generate engaging captions for project images
   */
  async generateImageCaption(imageUrl: string, projectContext: {
    title: string;
    technologies: string[];
    description: string;
  }): Promise<string> {
    try {
      const text = await generateVisionText({
        aiProvider: this.aiProvider,
        imageUrl,
        maxTokens: 200,
        model: 'primary',
        systemPrompt:
          'You are a technical writer who creates engaging captions for portfolio project images. Write captions that highlight the technical achievement, user experience, or problem-solving approach shown in the image.',
        temperature: 0.7,
        userText: `Create an engaging caption for this image from the project "${projectContext.title}".

Project Context:
- Technologies: ${projectContext.technologies.join(', ')}
- Description: ${projectContext.description}

Write a 1-2 sentence caption that highlights what makes this project impressive from a technical or user experience perspective.`,
      });

      return (
        text?.trim() ||
        'Technical implementation showcasing modern development practices.'
      );
    } catch (error) {
      console.error('Failed to generate image caption:', error);
      return 'Technical implementation showcasing modern development practices.';
    }
  }

  /**
   * Audit project visual content and suggest improvements
   */
  async auditProjectVisuals(projectId: string): Promise<ProjectVisualAudit> {
    const project = await db.portfolioProject.findUnique({
      where: { id: projectId },
      include: {
        documentationAssets: true
      }
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const currentAssets = project.documentationAssets.map(asset => ({
      type: asset.fileType,
      url: asset.fileUrl,
      description: asset.description,
      altText: asset.altText
    }));

    // Generate suggestions based on project type and current assets
    const suggestions = await this.generateVisualSuggestions(project, currentAssets);

    // Identify missing critical assets
    const missingAssets = this.identifyMissingAssets(project, currentAssets);

    // Generate improvement recommendations
    const recommendations = await this.generateImprovementRecommendations(project, currentAssets);

    return {
      projectId,
      currentAssets,
      suggestions,
      missingAssets,
      improvementRecommendations: recommendations
    };
  }

  /**
   * Generate visual content suggestions based on project analysis
   */
  private async generateVisualSuggestions(project: any, currentAssets: any[]): Promise<VisualContentSuggestion[]> {
    const prompt = `Analyze this portfolio project and suggest visual content that would enhance its presentation:

Project: ${project.title}
Type: ${project.type}
Description: ${project.description}
Technologies: ${project.technologies.join(', ')}
Current Assets: ${currentAssets.map(asset => asset.type).join(', ')}

Suggest 3-5 specific visual assets that would make this project more compelling in a portfolio context.`;

    try {
      const response = await generateAIText(prompt, {
        aiProvider: this.aiProvider,
        system: `You are a portfolio design expert who suggests visual content to enhance project presentations.

Return suggestions as JSON array with this structure:
[
  {
    "type": "screenshot|diagram|flowchart|mockup|video|gif",
    "title": "Suggestion title",
    "description": "What this visual should show",
    "priority": "high|medium|low",
    "reasoning": "Why this visual would be valuable"
  }
]`,
        temperature: 0.7,
      });

      if (response) {
        try {
          // Strip markdown code fences if present
          const jsonText = response
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '');
          return JSON.parse(jsonText);
        } catch {
          // Fallback if JSON parsing fails
        }
      }
    } catch (error) {
      console.error('Failed to generate visual suggestions:', error);
    }

    // Fallback suggestions based on project type
    return this.getDefaultVisualSuggestions(project.type);
  }

  /**
   * Get default visual suggestions based on project type
   */
  private getDefaultVisualSuggestions(projectType: string): VisualContentSuggestion[] {
    const baseProjectSuggestions: VisualContentSuggestion[] = [
      {
        type: 'screenshot',
        title: 'Application Screenshot',
        description: 'High-quality screenshot showing the main interface or key functionality',
        priority: 'high',
        reasoning: 'Visual proof of the working application increases credibility'
      },
      {
        type: 'diagram',
        title: 'Architecture Diagram',
        description: 'System architecture or data flow diagram',
        priority: 'medium',
        reasoning: 'Demonstrates technical thinking and system design skills'
      }
    ];

    switch (projectType) {
      case 'CODE_PROJECT':
        return [
          ...baseProjectSuggestions,
          {
            type: 'flowchart',
            title: 'Algorithm Flowchart',
            description: 'Flowchart showing key algorithms or business logic',
            priority: 'medium',
            reasoning: 'Shows problem-solving approach and logical thinking'
          },
          {
            type: 'gif',
            title: 'Feature Demo GIF',
            description: 'Animated GIF showing key features in action',
            priority: 'high',
            reasoning: 'Engaging way to show functionality without requiring users to visit live demo'
          }
        ];

      case 'DESIGN_PROJECT':
        return [
          {
            type: 'mockup',
            title: 'Design Mockups',
            description: 'High-fidelity design mockups showing final UI',
            priority: 'high',
            reasoning: 'Essential for showcasing design skills and visual thinking'
          },
          {
            type: 'diagram',
            title: 'User Journey Map',
            description: 'Visual representation of user flow and experience',
            priority: 'high',
            reasoning: 'Demonstrates UX thinking and user-centered design approach'
          },
          {
            type: 'screenshot',
            title: 'Before/After Comparison',
            description: 'Side-by-side comparison showing design improvements',
            priority: 'medium',
            reasoning: 'Clearly shows the value and impact of the design work'
          }
        ];

      default:
        return baseProjectSuggestions;
    }
  }

  /**
   * Identify missing critical visual assets
   */
  private identifyMissingAssets(project: any, currentAssets: any[]): string[] {
    const missing = [];
    const assetTypes = currentAssets.map(asset => asset.type);

    // Check for critical missing assets based on project type
    if (!assetTypes.includes('image') && !assetTypes.includes('screenshot')) {
      missing.push('Project screenshot or main image');
    }

    if (project.type === 'CODE_PROJECT' && !assetTypes.includes('diagram')) {
      missing.push('Architecture or flow diagram');
    }

    if (project.type === 'DESIGN_PROJECT' && !assetTypes.includes('mockup')) {
      missing.push('Design mockups or wireframes');
    }

    if (project.demoUrl && !assetTypes.includes('gif') && !assetTypes.includes('video')) {
      missing.push('Demo video or animated GIF');
    }

    return missing;
  }

  /**
   * Generate improvement recommendations for existing assets
   */
  private async generateImprovementRecommendations(project: any, currentAssets: any[]): Promise<string[]> {
    const recommendations = [];

    // Check for missing alt text
    const assetsWithoutAltText = currentAssets.filter(asset =>
      asset.type === 'image' && !asset.altText
    );
    if (assetsWithoutAltText.length > 0) {
      recommendations.push(`Add alt text to ${assetsWithoutAltText.length} image(s) for accessibility`);
    }

    // Check for missing descriptions
    const assetsWithoutDescription = currentAssets.filter(asset => !asset.description);
    if (assetsWithoutDescription.length > 0) {
      recommendations.push(`Add descriptions to ${assetsWithoutDescription.length} asset(s) to provide context`);
    }

    // Suggest visual variety
    const uniqueTypes = new Set(currentAssets.map(asset => asset.type));
    if (uniqueTypes.size < 2 && currentAssets.length > 2) {
      recommendations.push('Consider adding different types of visual content (diagrams, screenshots, mockups) for better engagement');
    }

    // Project-specific recommendations
    if (project.type === 'CODE_PROJECT' && currentAssets.length < 3) {
      recommendations.push('Add more visuals to better showcase the technical implementation and user experience');
    }

    if (project.githubUrl && !currentAssets.some(asset => asset.description?.includes('code'))) {
      recommendations.push('Consider adding code snippet visuals or architecture diagrams to showcase technical skills');
    }

    return recommendations;
  }

  /**
   * Enhance project with AI-generated visual descriptions
   */
  async enhanceProjectVisuals(projectId: string): Promise<{
    enhancedAssets: number;
    generatedAltTexts: number;
    generatedCaptions: number;
  }> {
    const project = await db.portfolioProject.findUnique({
      where: { id: projectId },
      include: {
        documentationAssets: true
      }
    });

    if (!project) {
      throw new Error('Project not found');
    }

    let enhancedAssets = 0;
    let generatedAltTexts = 0;
    let generatedCaptions = 0;

    // Enhance each visual asset
    for (const asset of project.documentationAssets) {
      if (asset.fileType === 'image') {
        const updates: any = {};

        // Generate alt text if missing
        if (!asset.altText) {
          try {
            const altText = await this.generateAltText(
              asset.fileUrl,
              `${project.title} - ${asset.description || 'Project image'}`
            );
            updates.altText = altText;
            generatedAltTexts++;
          } catch (error) {
            console.error('Failed to generate alt text for asset:', asset.id, error);
          }
        }

        // Generate caption if missing description
        if (!asset.description) {
          try {
            const caption = await this.generateImageCaption(asset.fileUrl, {
              title: project.title,
              technologies: project.technologies,
              description: project.description
            });
            updates.description = caption;
            generatedCaptions++;
          } catch (error) {
            console.error('Failed to generate caption for asset:', asset.id, error);
          }
        }

        // Update asset if we have enhancements
        if (Object.keys(updates).length > 0) {
          await db.projectDocumentationAsset.update({
            where: { id: asset.id },
            data: updates
          });
          enhancedAssets++;
        }
      }
    }

    return {
      enhancedAssets,
      generatedAltTexts,
      generatedCaptions
    };
  }

  /**
   * Generate thumbnail for project (placeholder - would integrate with image processing service)
   */
  async generateProjectThumbnail(projectId: string, sourceImageUrl: string): Promise<string> {
    // This would integrate with an image processing service like Cloudinary, ImageKit, etc.
    // For now, return the original URL
    console.log(`Would generate thumbnail for project ${projectId} from ${sourceImageUrl}`);
    return sourceImageUrl;
  }

  /**
   * Optimize image for web display (placeholder)
   */
  async optimizeImage(imageUrl: string, options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
  }): Promise<string> {
    // This would integrate with an image optimization service
    console.log(`Would optimize image ${imageUrl} with options:`, options);
    return imageUrl;
  }
}

export const visualContentEnhancer = new VisualContentEnhancer();

export function createVisualContentEnhancer(
  options: { readonly aiProvider?: AiProvider } = {},
): VisualContentEnhancer {
  return new VisualContentEnhancer(options);
}