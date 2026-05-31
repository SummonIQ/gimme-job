export enum EventType {
  DataUpdate = 'data-update',
  Notification = 'notification',
}

export type Event<T = EventType, P = Record<string, unknown>> = {
  channel: string;
  payload: P;
  type?: T;
};
