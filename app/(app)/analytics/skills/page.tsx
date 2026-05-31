import { SkillsGapAnalysis } from '@/components/analytics/skills-gap-analysis';
import { Page, PageContent, PageHeader } from '@/components/layout/page';

export default function SkillsPage() {
  return (
    <Page name="analytics-skills" title="Skills Gap Analysis">
      <PageHeader
        title="Skills Gap Analysis"
        description="Skills improvement insights"
      />
      <PageContent>
        <SkillsGapAnalysis />
      </PageContent>
    </Page>
  );
}
