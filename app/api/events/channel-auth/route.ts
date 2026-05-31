import { type NextRequest, NextResponse } from 'next/server';

import { eventServerClient } from '@/lib/events/clients/server';
import { getSessionUser } from '@/lib/user/query';

const POST = async (req: NextRequest) => {
  const user = await getSessionUser();

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let channelName = '';
  let socketId = '';

  try {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      channelName =
        typeof body?.channel_name === 'string' ? body.channel_name : '';
      socketId = typeof body?.socket_id === 'string' ? body.socket_id : '';
    } else {
      const requestBody = await req.text();
      const parsedParams = new URLSearchParams(requestBody);
      channelName =
        parsedParams.get('channel_name') ??
        req.nextUrl.searchParams.get('channel_name') ??
        '';
      socketId =
        parsedParams.get('socket_id') ??
        req.nextUrl.searchParams.get('socket_id') ??
        '';
    }
  } catch (error) {
    console.error('[PUSHER_CHANNEL_AUTH] Failed to parse request body', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }

  if (!socketId || !channelName) {
    return NextResponse.json(
      {
        error: 'Missing required parameters: socket_id and channel_name',
        received: { channelName, socketId },
      },
      { status: 400 },
    );
  }

  const channelAuth = eventServerClient.authorizeChannel(
    socketId,
    channelName,
    {
      user_id: user.id,
    },
  );

  return NextResponse.json(channelAuth);
};

export { POST };
