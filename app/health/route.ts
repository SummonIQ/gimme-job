import { NextResponse } from 'next/server';

interface HealthResponse {
  status: 'ok';
}

export function GET(): NextResponse<HealthResponse> {
  return NextResponse.json({ status: 'ok' }, { status: 200 });
}
