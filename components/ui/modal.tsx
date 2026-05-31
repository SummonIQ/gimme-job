'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/css';

const Modal = DialogPrimitive.Root;

const ModalTrigger = DialogPrimitive.Trigger;

const ModalPortal = DialogPrimitive.Portal;

const ModalClose = DialogPrimitive.Close;

export const MODAL_CHROME_BUTTON_CLASS = cn(
  'size-9 rounded-full border border-border bg-background p-0',
  'inline-flex items-center justify-center',
  'transition-[border-color,box-shadow,background-color,color,transform] duration-150 active:scale-95',
  'hover:border-rose-500/25 hover:bg-rose-500/10 hover:text-rose-500',
  'focus:outline-none focus:border-transparent focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-background',
  'focus-visible:outline-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  'disabled:pointer-events-none disabled:opacity-50',
  'hover:drop-shadow-xl hover:drop-shadow-rose-500/25',
);

const ModalCloseButton = ({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) => (
  <DialogPrimitive.Close
    className={cn(MODAL_CHROME_BUTTON_CLASS, className)}
    {...props}
  >
    <X className="h-4 w-4" />
    <span className="sr-only">Close</span>
  </DialogPrimitive.Close>
);
ModalCloseButton.displayName = DialogPrimitive.Close.displayName;

const ModalOverlay = ({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/80 data-[state=closed]:duration-300 data-[state=open]:duration-300',
      className,
    )}
    {...props}
  />
);
ModalOverlay.displayName = DialogPrimitive.Overlay.displayName;

const modalVariants = cva(
  // Base classes for all modals
  'fixed bg-background/15 dark:bg-background/90 backdrop-blur-sm z-[51] isolate data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:ease-in transition-shadow duration-300 data-[state=closed]:shadow-sm data-[state=open]:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] data-[state=open]:drop-shadow-[0_20px_25px_rgba(0,0,0,0.35)]',
  {
    variants: {
      variant: {
        default: [
          'left-[50%] top-[50%] w-auto max-h-[calc(100svh-2rem)] translate-x-[-50%] translate-y-[-50%] border border-border grid overflow-hidden',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:slide-in-from-bottom-4',
          'data-[state=closed]:duration-200 data-[state=open]:duration-300',
          'sm:rounded-3xl',
        ],
        'from-trigger': [
          'w-[calc(100vw-2rem)] max-h-[calc(100svh-2rem)] border border-border grid sm:rounded-3xl overflow-hidden',
        ],
        drawer: [
          'bottom-0 border-t border-border rounded-t-3xl overflow-hidden',
          'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
          'data-[state=closed]:duration-300 data-[state=open]:duration-400',
          'data-[state=open]:ease-[cubic-bezier(0.16,1,0.3,1)]',
        ],
        'slide-out': [
          'inset-y-0 right-0 border-l border-border overflow-hidden',
          'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
          'data-[state=closed]:duration-300 data-[state=open]:duration-400',
          'data-[state=open]:ease-[cubic-bezier(0.16,1,0.3,1)]',
        ],
      },
      size: {
        sm: 'w-sm',
        md: 'w-md',
        lg: 'w-lg',
        xl: 'w-xl',
        '2xl': 'w-2xl',
        '3xl': 'w-3xl',
        '4xl': 'w-4xl',
        full: 'max-w-full',
      },
      drawerSide: {
        left: 'left-0 border-r border-border',
        center: 'left-1/2 -translate-x-1/2',
        right: 'right-0 border-l border-border',
        full: 'left-0 right-0',
      },
      drawerWidth: {
        sm: 'w-80',
        md: 'w-96',
        lg: 'w-[32rem]',
        xl: 'w-[40rem]',
        '2xl': 'w-[48rem]',
        '3xl': 'w-[56rem]',
        '1/2': 'w-1/2',
        '2/3': 'w-2/3',
        '3/4': 'w-3/4',
        '4/5': 'w-4/5',
        full: 'w-full',
      },
      slideWidth: {
        sm: 'w-80',
        md: 'w-96',
        lg: 'w-[32rem]',
        xl: 'w-[40rem]',
        '2xl': 'w-[48rem]',
        '1/2': 'w-1/2',
        '2/3': 'w-2/3',
        '3/4': 'w-3/4',
        full: 'w-full',
      },
      drawerHeight: {
        sm: 'h-80',
        md: 'h-96',
        lg: 'h-[32rem]',
        xl: 'h-[40rem]',
        '2xl': 'h-[48rem]',
        '1/2': 'h-1/2',
        '2/3': 'h-2/3',
        '3/4': 'h-3/4',
        '4/5': 'h-4/5',
        auto: 'h-auto',
        full: 'h-full',
      },
      margin: {
        none: '',
        sm: 'm-2 rounded-3xl shadow-xl',
        md: 'm-4 rounded-3xl shadow-xl',
        lg: 'm-6 rounded-3xl shadow-xl',
        xl: 'm-8 rounded-3xl shadow-xl',
        '2xl': 'm-12 rounded-3xl shadow-xl',
      },
      hasMargin: {
        true: 'data-[state=closed]:zoom-out-75 data-[state=open]:zoom-in-75',
        false: '',
      },
      hasMarginBottom: {
        true: 'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        false: '',
      },
    },
    compoundVariants: [
      // Full width drawer (bottom sheet) - no margin
      {
        variant: 'drawer',
        drawerSide: 'full',
        margin: 'none',
        className: 'rounded-t-3xl !max-w-none !w-full',
      },
      // Full width drawer with margin
      {
        variant: 'drawer',
        drawerSide: 'full',
        className: '!max-w-none !w-auto',
      },
      // Left drawer - no rounding by default (added conditionally based on margin)
      {
        variant: 'drawer',
        drawerSide: 'left',
        className:
          'rounded-tl-none rounded-bl-none rounded-br-none overflow-hidden',
      },
      // Right drawer - no rounding by default (added conditionally based on margin)
      {
        variant: 'drawer',
        drawerSide: 'right',
        className:
          'rounded-tr-none rounded-bl-none rounded-br-none overflow-hidden',
      },
      // Slide out panel with no margin
      {
        variant: 'slide-out',
        margin: 'none',
        className:
          'rounded-l-3xl rounded-r-none overflow-hidden !left-auto !right-0 !translate-x-0',
      },
      // Slide out panel - prevent any centering for all cases
      {
        variant: 'slide-out',
        className: '!left-auto !translate-x-0',
      },
    ],
    defaultVariants: {
      variant: 'default',
      drawerSide: 'center',
      drawerWidth: 'md',
      drawerHeight: 'auto',
      slideWidth: 'md',
      margin: 'none',
      hasMargin: false,
      hasMarginBottom: false,
    },
  },
);

export interface ModalContentProps
  extends
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof modalVariants> {
  triggerRef?: React.RefObject<HTMLElement>;
  showOverlay?: boolean;
  marginTop?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  marginRight?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  marginBottom?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  marginLeft?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showClose?: boolean;
  closeActions?: React.ReactNode;
}

const ModalContent = React.forwardRef<HTMLDivElement, ModalContentProps>(
  (
    {
      className,
      variant,
      size,
      drawerSide,
      drawerWidth,
      drawerHeight,
      slideWidth,
      margin,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
      triggerRef,
      showOverlay = true,
      showClose = true,
      closeActions,
      children,
      ...props
    },
    ref,
  ) => {
    const [triggerRect, setTriggerRect] = React.useState<DOMRect | null>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
      if (variant === 'from-trigger' && triggerRef?.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setTriggerRect(rect);
      }
    }, [variant, triggerRef]);

    React.useEffect(() => {
      if (variant === 'from-trigger' && triggerRect && contentRef.current) {
        const modal = contentRef.current;

        // Position modal at center
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        // Get trigger center
        const triggerCenterX = triggerRect.left + triggerRect.width / 2;
        const triggerCenterY = triggerRect.top + triggerRect.height / 2;

        // Calculate initial scale based on trigger size vs modal size
        const modalRect = modal.getBoundingClientRect();
        const scaleX = triggerRect.width / modalRect.width;
        const scaleY = triggerRect.height / modalRect.height;
        const initialScale = Math.min(scaleX, scaleY, 0.1); // Cap at 10%

        // Set up initial position and style
        modal.style.position = 'fixed';
        modal.style.left = `${triggerCenterX}px`;
        modal.style.top = `${triggerCenterY}px`;
        modal.style.transform = `translate(-50%, -50%) scale(${initialScale})`;
        modal.style.opacity = '0';
        modal.style.zIndex = '51';

        // Force reflow
        modal.offsetHeight;

        // Animate to final state
        modal.animate(
          [
            {
              left: `${triggerCenterX}px`,
              top: `${triggerCenterY}px`,
              transform: `translate(-50%, -50%) scale(${initialScale})`,
              opacity: '0',
            },
            {
              left: `${centerX}px`,
              top: `${centerY}px`,
              transform: 'translate(-50%, -50%) scale(1)',
              opacity: '1',
            },
          ],
          {
            duration: 300,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            fill: 'forwards',
          },
        );
      }
    }, [variant, triggerRect]);

    const combinedRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        contentRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [ref],
    );

    // Restore body scroll when overlay is not shown
    React.useEffect(() => {
      if (!showOverlay) {
        // Remove Radix's scroll lock styles
        document.body.style.pointerEvents = '';
        document.body.style.overflow = '';
      }
    }, [showOverlay]);

    // Determine margin state for variant logic
    const hasAnyMargin =
      (marginTop && marginTop !== 'none') ||
      (marginRight && marginRight !== 'none') ||
      (marginBottom && marginBottom !== 'none') ||
      (marginLeft && marginLeft !== 'none') ||
      (margin && margin !== 'none');

    const hasMarginBottom = marginBottom && marginBottom !== 'none';

    // Build side-specific margin classes when needed
    const getSizeValue = (size?: string) => {
      switch (size) {
        case 'sm':
          return '2';
        case 'md':
          return '4';
        case 'lg':
          return '6';
        case 'xl':
          return '8';
        case '2xl':
          return '12';
        default:
          return null;
      }
    };

    const buildSideMargins = () => {
      const margins = [];
      if (marginTop && marginTop !== 'none')
        margins.push(`mt-${getSizeValue(marginTop)}`);
      if (marginRight && marginRight !== 'none')
        margins.push(`mr-${getSizeValue(marginRight)}`);
      if (marginBottom && marginBottom !== 'none')
        margins.push(`mb-${getSizeValue(marginBottom)}`);
      if (marginLeft && marginLeft !== 'none')
        margins.push(`ml-${getSizeValue(marginLeft)}`);
      return margins.join(' ');
    };

    const sideMarginClass = buildSideMargins();

    // Build custom margin classes for specific sides
    const customMarginClass = marginLeft
      ? `left-${getSizeValue(marginLeft)}`
      : marginRight
        ? `right-${getSizeValue(marginRight)}`
        : '';

    // Override margin on the attached edge for slide panels and side drawers
    const edgeOverrideClass = '';

    // Conditional corner rounding for side drawers based on margin presence
    const drawerCornerClass =
      variant === 'drawer' &&
      drawerSide === 'left' &&
      ((marginLeft && marginLeft !== 'none') || (margin && margin !== 'none'))
        ? 'rounded-tl-3xl rounded-tr-3xl'
        : variant === 'drawer' &&
            drawerSide === 'right' &&
            ((marginRight && marginRight !== 'none') ||
              (margin && margin !== 'none'))
          ? 'rounded-tl-3xl'
          : '';

    return (
      <ModalPortal>
        <ModalOverlay
          className={cn(
            'opacity-0',
            showOverlay && 'opacity-100',
            !showOverlay && 'pointer-events-none',
          )}
        />
        <DialogPrimitive.Content
          ref={combinedRef}
          onPointerDownOutside={e => {
            // Allow clicking outside when no overlay
            if (!showOverlay) {
              e.preventDefault();
            }
          }}
          onInteractOutside={e => {
            // Allow interaction outside when no overlay
            if (!showOverlay) {
              e.preventDefault();
            }
          }}
          className={cn(
            'outline-none focus:outline-none focus-visible:outline-none',
            modalVariants({
              variant,
              size,
              drawerSide: variant === 'drawer' ? drawerSide : undefined,
              drawerWidth:
                variant === 'drawer' && drawerSide !== 'full'
                  ? drawerWidth
                  : undefined,
              drawerHeight: variant === 'drawer' ? drawerHeight : undefined,
              slideWidth: variant === 'slide-out' ? slideWidth : undefined,
              margin,
              hasMargin:
                hasAnyMargin && (variant !== 'drawer' || drawerSide === 'full')
                  ? true
                  : false,
              hasMarginBottom:
                hasMarginBottom &&
                (variant !== 'drawer' || drawerSide === 'full')
                  ? true
                  : false,
            }),
            sideMarginClass,
            customMarginClass,
            edgeOverrideClass,
            drawerCornerClass,
            className,
            'dark:border-x-black/65 dark:border-b-black/80',
          )}
          {...props}
        >
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>

          {showClose && (
            <div
              className="absolute top-[24px] right-[24px] flex items-center gap-2 [&_button]:!h-9 [&_button]:!w-9 [&_button]:!rounded-full [&_button]:!border [&_button]:!p-0 [&_button_svg]:!size-4"
              data-close-wrapper
            >
              {closeActions}
              {closeActions ? (
                <span
                  aria-hidden="true"
                  className="h-6 w-px bg-border/80 dark:bg-black/80"
                />
              ) : null}
              <ModalCloseButton />
            </div>
          )}
        </DialogPrimitive.Content>
      </ModalPortal>
    );
  },
);
ModalContent.displayName = DialogPrimitive.Content.displayName;

export interface ModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  actions?: React.ReactNode;
}

const ModalHeader = ({
  className,
  actions,
  children,
  ...props
}: ModalHeaderProps) => (
  <div
    className={cn(
      'bg-background dark:bg-background/98 relative flex flex-col space-y-1.5 p-6 text-center sm:rounded-t-3xl sm:text-left border-b border-border/75',
      className,
    )}
    {...props}
  >
    {children}
    {actions && (
      <div className="absolute top-4.5 right-4.5 flex h-full max-h-[33px] min-h-[33px] items-center gap-3">
        {actions}
      </div>
    )}
  </div>
);
ModalHeader.displayName = 'ModalHeader';

const ModalFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'bg-background dark:bg-background/98 flex flex-row justify-between items-center p-6 sm:flex-row sm:justify-end sm:space-x-2 border-t border-border/75',
      className,
    )}
    {...props}
  />
);
ModalFooter.displayName = 'ModalFooter';

const ModalBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'bg-background/90 flex min-h-0 h-full flex-1 flex-col p-6 py-5 overflow-y-auto',
      className,
    )}
    {...props}
  />
);
ModalBody.displayName = 'ModalBody';

const ModalTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-xl leading-none font-semibold tracking-tight',
      className,
    )}
    {...props}
  />
));
ModalTitle.displayName = DialogPrimitive.Title.displayName;

const ModalDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-muted-foreground pr-[52px] text-sm', className)}
    {...props}
  />
));
ModalDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Modal,
  ModalBody,
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalPortal,
  ModalTitle,
  ModalTrigger,
  modalVariants,
};
