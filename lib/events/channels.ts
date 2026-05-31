export function getPrivateUserChannel(userId: string) {
  return `private-user-${userId.replace('|', '_')}`;
}
