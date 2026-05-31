import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      error:
        'Live external provider search is disabled. Use saved searches and ingestion pipelines instead.',
    },
    { status: 410 },
  );
}
