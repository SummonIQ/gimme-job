// In development, use your machine's local IP or tunnel URL
// In production, use the actual API URL
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.151:10100';

export const PUSHER_KEY = process.env.EXPO_PUBLIC_PUSHER_KEY || '';
export const PUSHER_CLUSTER = process.env.EXPO_PUBLIC_PUSHER_CLUSTER || '';
