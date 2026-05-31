// types/api.ts

export type Operator = 'eq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'in';

export interface Filter<T> {
  field: keyof T; // Field name on the domain object
  operator: Operator;
  value: any;
}

export type Include<T> = {
  [K in keyof T]: T[K] extends object ? Include<T[K]> : boolean;
};

export interface Sort<T> {
  // Field name on the domain object
  direction: 'asc' | 'desc';
  field: keyof T;
}

export interface Pagination {
  count?: number;
  start?: number;
}

export interface ApiQuery<T, I> {
  filters?: Array<Filter<T>>;
  include?: I;
  pagination?: Pagination;
  sort?: Array<Sort<T>>;
  userId?: string;
}

export type PrismaQuery<T> = {
  include?: Include<T>;
  orderBy?:
    | Record<string, 'asc' | 'desc'>
    | Array<Record<string, 'asc' | 'desc'>>;
  skip?: number;
  take?: number;
  where?: Record<string, any>;
};
