import { requireAuth, withApiErrorHandling } from '@/lib/errors/api';
import {
  completeReminder,
  createNetworkReminder,
  deleteNetworkReminder,
  getNetworkReminder,
  getNetworkReminders,
  updateNetworkReminder,
} from '@/lib/networking/reminders';
import { getCurrentUser } from '@/lib/user';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET handler for retrieving network reminders
 */
const handleGET = async (request: NextRequest): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  // If id is provided, get a specific reminder
  if (id) {
    const reminder = await getNetworkReminder(id);
    return NextResponse.json({ success: true, data: reminder });
  }

  // Otherwise, get filtered reminders
  const status = url.searchParams.get('status') as any;
  const type = url.searchParams.get('type') as any;
  const contactId = url.searchParams.get('contactId') ?? undefined;
  const search = url.searchParams.get('search') ?? undefined;
  const upcoming = url.searchParams.get('upcoming') === 'true';
  const sort = (url.searchParams.get('sort') as any) || 'dueDate';
  const sortDirection =
    (url.searchParams.get('sortDirection') as 'asc' | 'desc') || 'asc';

  const reminders = await getNetworkReminders({
    status,
    type,
    contactId,
    search,
    upcoming,
    sort,
    sortDirection,
  });

  return NextResponse.json({ success: true, data: reminders });
};

/**
 * POST handler for creating a new network reminder
 */
const handlePOST = async (request: NextRequest): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);
  const body = await request.json();

  // Check if this is a completion operation
  if (body.complete && body.id) {
    const reminder = await completeReminder(body.id);
    return NextResponse.json({ success: true, data: reminder });
  }

  // Regular reminder creation
  const reminder = await createNetworkReminder(body);

  return NextResponse.json({ success: true, data: reminder });
};

/**
 * PUT handler for updating a network reminder
 */
const handlePUT = async (request: NextRequest): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);
  const body = await request.json();

  if (!body.id) {
    return NextResponse.json(
      { success: false, message: 'Reminder ID is required' },
      { status: 400 },
    );
  }

  const reminder = await updateNetworkReminder(body.id, body);

  return NextResponse.json({ success: true, data: reminder });
};

/**
 * DELETE handler for removing a network reminder
 */
const handleDELETE = async (request: NextRequest): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { success: false, message: 'Reminder ID is required' },
      { status: 400 },
    );
  }

  await deleteNetworkReminder(id);

  return NextResponse.json({ success: true });
};

export const GET = withApiErrorHandling(handleGET);
export const POST = withApiErrorHandling(handlePOST);
export const PUT = withApiErrorHandling(handlePUT);
export const DELETE = withApiErrorHandling(handleDELETE);
