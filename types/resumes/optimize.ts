export type OptimizedResume = {
  ats_score: number;
  ats_summary: string;
  changelog: { change: string; reason: string }[];
  confidence_metrics: {
    estimated_visibility_boost: string;
    projected_shortlist_probability: number;
  };
  json: string;
  markdown: string;
  optimization_strategy: string;
  score_improvement: {
    delta: number;
    percent_change: number;
    previous_score: number;
    significant_improvements: string[];
  };
  summary: string;
};
