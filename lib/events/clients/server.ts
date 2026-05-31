import PusherServer from 'pusher';

export const eventServerClient = new PusherServer({
  appId: process.env.PUSHER_APP_ID as string,
  cluster: process.env.PUSHER_CLUSTER as string,
  key: process.env.PUSHER_KEY as string,
  secret: process.env.PUSHER_SECRET as string,
  useTLS: true,
});
