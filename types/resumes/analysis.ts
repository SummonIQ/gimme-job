export interface ResumeAnalysisJson {
  breakdown: {
    achievements: {
      feedback: string[];
      good_examples: string[];
      needs_improvement: string[];
      score: number;
    };
    formatting: {
      feedback: string[];
      incompatible_elements: string[];
      score: number;
    };
    grammar: {
      issues: [
        {
          description: string[];
          example: string[];
          suggestion: string[];
          type: string[];
        },
      ];
      issues_found: number;
    };
    keywords: {
      feedback: string[];
      missing: string[];
      overused: string[];
      score: number;
      suggested: string[];
    };
    readability: {
      feedback: string[];
      score: number;
    };
    sections: {
      details: Array<{
        feedback: string[];
        issues: string[];
        missing: string[];
        name: string;
        score: number;
      }>;
      score: number;
    };
    spelling: {
      issues: Array<{
        context_sentence: string;
        suggestion: string;
        word: string;
      }>;
      issues_found: number;
    };
    strengths: string[];
    weaknesses: string[];
  };
  recommendations: {
    content_enhancements: string[];
    long_term_improvements: string[];
    priority_fixes: string[];
  };
  score: number;
  summary: string;
}

export interface ResumeAnalysisData {
  analysis: ResumeAnalysisJson;
}
