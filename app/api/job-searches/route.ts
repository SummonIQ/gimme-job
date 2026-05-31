import { db } from '@/lib/db/client';
import { AppError, ErrorCode } from '@/lib/errors';
import { requireAuth, withApiErrorHandling } from '@/lib/errors/api';
import { getCurrentUser } from '@/lib/user/query';
import { Prisma } from '@/generated/prisma/browser';
import { NextRequest, NextResponse } from 'next/server';

const handleGET = async (): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);

  const searches = await db.jobSearch.findMany({
    where: {
      userId: user!.id,
      saved: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 20,
    select: {
      id: true,
      searchTerm: true,
      location: true,
      createdAt: true,
      metadata: true,
    },
  });

  return NextResponse.json(searches);
};

const handlePOST = async (request: NextRequest): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);

  const body = await request.json();
  const {
    searchTerm,
    location,
    filters,
  }: {
    filters?: Record<string, unknown>;
    location?: string | null;
    searchTerm?: string;
  } = body;

  if (!searchTerm || searchTerm.trim() === '') {
    throw new AppError({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Search term is required',
      userMessage: 'Please enter a search term',
      statusCode: 400,
    });
  }

  const filtersPayload: Prisma.InputJsonValue =
    filters && Object.keys(filters).length > 0
      ? (filters as Prisma.InputJsonValue)
      : ({
          location: location?.trim() || '',
          search: searchTerm.trim(),
        } as Prisma.InputJsonValue);

  // Check if this exact search already exists
  const existingSearch = await db.jobSearch.findFirst({
    where: {
      userId: user!.id,
      searchTerm: searchTerm.trim(),
      location: location?.trim() || null,
    },
  });

  if (existingSearch) {
    const existingMetadata =
      existingSearch.metadata && typeof existingSearch.metadata === 'object'
        ? (existingSearch.metadata as Record<string, unknown>)
        : {};

    // If search exists, update it to be saved
    const updatedSearch = await db.jobSearch.update({
      where: { id: existingSearch.id },
      data: {
        saved: true,
        metadata: {
          ...(existingMetadata as Record<string, Prisma.InputJsonValue>),
          filters: filtersPayload,
        } as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json(updatedSearch, { status: 200 });
  }

  // Create new search and mark as saved
  const jobSearch = await db.jobSearch.create({
    data: {
      userId: user!.id,
      searchTerm: searchTerm.trim(),
      location: location?.trim() || null,
      saved: true,
      metadata: {
        filters: filtersPayload,
      } as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json(jobSearch, { status: 201 });
};

export const GET = withApiErrorHandling(handleGET);
export const POST = withApiErrorHandling(handlePOST);
