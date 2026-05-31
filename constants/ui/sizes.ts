export const UI_SIZES = ['xs', 'sm', 'default', 'lg', 'xl'] as const;

export type UISize = (typeof UI_SIZES)[number];

export const UI_INTERACTIVE_ELEMENT_SIZE_HEIGHT = {
  default: 'h-9',
  lg: 'h-11',
  sm: 'h-8',
  xl: 'h-12',
  xs: 'h-6',
} as const satisfies Record<UISize, string>;

export const UI_SIZE_TEXT = {
  default: 'text-sm',
  lg: 'text-base',
  sm: 'text-sm',
  xl: 'text-lg',
  xs: 'text-xs',
} as const satisfies Record<UISize, string>;

export const UI_SIZE_ICON = {
  default: 'size-4',
  lg: 'size-4',
  sm: 'size-3.5',
  xl: 'size-4.5',
  xs: 'size-3',
} as const satisfies Record<UISize, string>;

export const UI_SIZE_GAP = {
  default: 'gap-1.5',
  lg: 'gap-2',
  sm: 'gap-1.5',
  xl: 'gap-2',
  xs: 'gap-1',
} as const satisfies Record<UISize, string>;

export const UI_SIZE_LEADING = {
  default: 'leading-4',
  lg: 'leading-5',
  sm: 'leading-3.5',
  xl: 'leading-6',
  xs: 'leading-3',
} as const satisfies Record<UISize, string>;
