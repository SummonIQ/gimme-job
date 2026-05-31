import { NextResponse, type NextRequest } from 'next/server';

import {
  deleteUserKnowledge,
  getUserKnowledge,
  getUserKnowledgeEntries,
  setUserKnowledge,
} from '@/lib/user/knowledge';
import { getCurrentUser } from '@/lib/user/query';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [knowledge, entries] = await Promise.all([
    getUserKnowledge(user.id),
    getUserKnowledgeEntries(user.id),
  ]);
  return NextResponse.json({ entries, knowledge });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { key, value, source } = body as {
    key?: string;
    value?: string;
    source?: string;
  };

  if (!key || typeof value !== 'string') {
    return NextResponse.json(
      { error: 'key and value are required' },
      { status: 400 },
    );
  }

  await setUserKnowledge(
    user.id,
    key,
    value,
    source || 'manual',
    source === 'form' ? 0.6 : 1.0,
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  if (!key) {
    return NextResponse.json({ error: 'key is required' }, { status: 400 });
  }

  await deleteUserKnowledge(user.id, key);
  return NextResponse.json({ ok: true });
}
