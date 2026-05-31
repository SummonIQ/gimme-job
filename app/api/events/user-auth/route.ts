import { NextRequest, NextResponse } from 'next/server';
import { eventServerClient } from '@/lib/events/clients';
import { getSessionUser } from '@/lib/user/query';
import { parseQueryString } from '@/lib/strings';
import { AppError, ErrorCode } from '@/lib/errors';
import { withApiErrorHandling, requireAuth } from '@/lib/errors/api';

const handlePOST = async (req: NextRequest) => {
  const user = await getSessionUser();
  requireAuth(user);

  if (!user?.id || typeof user.id !== 'string') {
    throw new AppError({
      code: ErrorCode.UNAUTHORIZED,
      message: 'Invalid user ID',
      userMessage: 'Authentication failed. Please log in again.',
    });
  }

  let requestBody: string;
  try {
    requestBody = await req.text();
  } catch (error) {
    throw new AppError({
      code: ErrorCode.INVALID_INPUT,
      message: 'Failed to read request body',
      userMessage: 'Invalid request format.',
      cause: error,
    });
  }

  const { socket_id } = parseQueryString(requestBody);

  if (!socket_id) {
    throw new AppError({
      code: ErrorCode.INVALID_INPUT,
      message: 'Missing socket_id in request body',
      userMessage: 'Invalid authentication request.',
    });
  }

  const auth = eventServerClient.authenticateUser(socket_id, {
    id: user!.id,
    name: user!.email,
  });

  return NextResponse.json(auth);
};

const POST = withApiErrorHandling(handlePOST);

export { POST };
