import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';
import { db } from '@/lib/db/client';

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const action = searchParams.get('action');
  const actionType = searchParams.get('actionType');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    const where: any = {
      userId: session.user.id,
    };

    if (action) {
      where.action = action;
    }

    if (actionType) {
      where.actionType = actionType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [logs, total] = await Promise.all([
      db.automationAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.automationAuditLog.count({ where }),
    ]);

    return Response.json({
      logs,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}