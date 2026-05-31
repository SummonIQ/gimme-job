export type QueueState<T> = Record<
  string,
  {
    createdAt?: Date;
    name: string;
    progress?: number;
    status: T;
    updatedAt?: Date;
  }
>;
