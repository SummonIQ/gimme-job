export interface ReportColumn<T> {
  align?: 'left' | 'center' | 'right';
  cellFn?: (row: T) => React.ReactNode;
  className?: string;
  // For header: either header or headerFn (if provided, headerFn is used)
  header?: string;
  headerFn?: () => React.ReactNode;
  hideable?: boolean;
  // For cell content: either key (to show row[key]) or cellFn for custom content.
  key?: keyof T;
  maxWidth?: string;
  minWidth?: string;
  // Sorting is enabled only when key is provided.
  sortable?: boolean;
  // For toggling column visibility.
  visible?: boolean;
}
