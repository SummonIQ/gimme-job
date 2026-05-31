import { NextRequest, NextResponse } from 'next/server';
import { getSkillGapAnalysis } from '@/lib/skills/gap-analysis';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const analysis = await getSkillGapAnalysis(id);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Error fetching skill gap analysis:', error);
    return NextResponse.json(
      { error: 'Failed to fetch skill gap analysis' },
      { status: 500 }
    );
  }
}