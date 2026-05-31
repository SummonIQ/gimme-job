import { requireAuth, withApiErrorHandling } from '@/lib/errors/api';
import {
  createNetworkContact,
  deleteNetworkContact,
  getNetworkContact,
  getNetworkContacts,
  importContacts,
  updateNetworkContact,
} from '@/lib/networking/contacts';
import { getCurrentUser } from '@/lib/user';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET handler for retrieving network contacts
 */
const handleGET = async (request: NextRequest): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  // If id is provided, get a specific contact
  if (id) {
    const contact = await getNetworkContact(id);
    return NextResponse.json({ success: true, data: contact });
  }

  // Otherwise, get filtered contacts
  const status = url.searchParams.get('status') as any;
  const source = url.searchParams.get('source') as any;
  const priority = url.searchParams.get('priority') as any;
  const search = url.searchParams.get('search') ?? undefined;
  const tag = url.searchParams.get('tag') ?? undefined;
  const sort = (url.searchParams.get('sort') as any) || 'createdAt';
  const sortDirection =
    (url.searchParams.get('sortDirection') as 'asc' | 'desc') || 'desc';

  const contacts = await getNetworkContacts({
    status,
    source,
    priority,
    search,
    tag,
    sort,
    sortDirection,
  });

  return NextResponse.json({ success: true, data: contacts });
};

/**
 * POST handler for creating a new network contact
 */
const handlePOST = async (request: NextRequest): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);
  const body = await request.json();

  // Check if this is an import operation
  if (body.import && Array.isArray(body.contacts)) {
    const result = await importContacts(body.contacts, body.source);
    return NextResponse.json({ success: true, data: result });
  }

  // Regular contact creation
  const contact = await createNetworkContact(body);

  return NextResponse.json({ success: true, data: contact });
};

/**
 * PUT handler for updating a network contact
 */
const handlePUT = async (request: NextRequest): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);
  const body = await request.json();

  if (!body.id) {
    return NextResponse.json(
      { success: false, message: 'Contact ID is required' },
      { status: 400 },
    );
  }

  const contact = await updateNetworkContact(body.id, body);

  return NextResponse.json({ success: true, data: contact });
};

/**
 * DELETE handler for removing a network contact
 */
const handleDELETE = async (request: NextRequest): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { success: false, message: 'Contact ID is required' },
      { status: 400 },
    );
  }

  await deleteNetworkContact(id);

  return NextResponse.json({ success: true });
};

export const GET = withApiErrorHandling(handleGET);
export const POST = withApiErrorHandling(handlePOST);
export const PUT = withApiErrorHandling(handlePUT);
export const DELETE = withApiErrorHandling(handleDELETE);
