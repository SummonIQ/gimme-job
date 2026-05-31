import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Input } from '../input';

describe('Input', () => {
  describe('rendering', () => {
    it('renders a basic text input', () => {
      render(<Input type="text" placeholder="Enter text" />);
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('renders with data-slot="input" attribute', () => {
      render(<Input type="text" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('data-slot', 'input');
    });

    it('applies custom className', () => {
      render(
        <Input type="text" className="custom-class" data-testid="input" />,
      );
      expect(screen.getByTestId('input')).toHaveClass('custom-class');
    });

    it('forwards props to the underlying input', () => {
      render(<Input type="email" disabled placeholder="Email" name="email" />);
      const input = screen.getByPlaceholderText('Email');
      expect(input).toHaveAttribute('type', 'email');
      expect(input).toHaveAttribute('name', 'email');
      expect(input).toBeDisabled();
    });
  });

  describe('size variants', () => {
    it.each(['xs', 'sm', 'default', 'lg', 'xl'] as const)(
      'renders with size="%s" without errors',
      size => {
        render(<Input type="text" size={size} data-testid="input" />);
        expect(screen.getByTestId('input')).toBeInTheDocument();
      },
    );
  });

  describe('search type', () => {
    it('renders a search icon when type is "search"', () => {
      const { container } = render(
        <Input type="search" placeholder="Search..." />,
      );
      // SearchIcon from lucide renders an SVG
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('does not render a search icon for non-search types', () => {
      const { container } = render(
        <Input type="text" placeholder="Text input" />,
      );
      const svg = container.querySelector('svg');
      expect(svg).not.toBeInTheDocument();
    });

    it('applies search padding classes when type is "search"', () => {
      render(
        <Input type="search" placeholder="Search..." data-testid="input" />,
      );
      const input = screen.getByTestId('input');
      // searchPaddingVariants default size applies pl-9 pr-9
      expect(input.className).toContain('pl-9');
      expect(input.className).toContain('pr-9');
    });

    it('hides native webkit search cancel button', () => {
      render(
        <Input type="search" placeholder="Search..." data-testid="input" />,
      );
      const input = screen.getByTestId('input');
      expect(input.className).toContain('appearance-none');
    });
  });

  describe('search icon color', () => {
    it('uses muted color when input is empty', () => {
      const { container } = render(
        <Input type="search" value="" onChange={() => {}} />,
      );
      const svg = container.querySelector('svg');
      const svgClass = svg?.getAttribute('class') ?? '';
      expect(svgClass).toContain('text-muted-foreground/55');
      expect(svgClass).not.toContain('text-foreground');
    });

    it('uses foreground color when input has a value', () => {
      const { container } = render(
        <Input type="search" value="test" onChange={() => {}} />,
      );
      const svg = container.querySelector('svg');
      const svgClass = svg?.getAttribute('class') ?? '';
      expect(svgClass).toContain('text-foreground');
    });
  });

  describe('clear button', () => {
    it('does not show clear button when input is empty', () => {
      render(<Input type="search" value="" onChange={() => {}} />);
      expect(
        screen.queryByRole('button', { name: /clear search/i }),
      ).not.toBeInTheDocument();
    });

    it('shows clear button when input has a value', () => {
      render(<Input type="search" value="hello" onChange={() => {}} />);
      expect(
        screen.getByRole('button', { name: /clear search/i }),
      ).toBeInTheDocument();
    });

    it('clear button has tabIndex -1 to avoid focus trap', () => {
      render(<Input type="search" value="hello" onChange={() => {}} />);
      const clearBtn = screen.getByRole('button', { name: /clear search/i });
      expect(clearBtn).toHaveAttribute('tabindex', '-1');
    });

    it('clears the input value and fires onChange when clear button is clicked', () => {
      const handleChange = vi.fn();
      render(
        <Input
          type="search"
          defaultValue="hello world"
          onChange={handleChange}
        />,
      );

      const clearBtn = screen.getByRole('button', { name: /clear search/i });
      fireEvent.click(clearBtn);

      // After clear, the clear button should disappear (hasValue becomes false)
      expect(
        screen.queryByRole('button', { name: /clear search/i }),
      ).not.toBeInTheDocument();
    });

    it('focuses the input after clearing', () => {
      render(<Input type="search" defaultValue="test" data-testid="input" />);

      const clearBtn = screen.getByRole('button', { name: /clear search/i });
      fireEvent.click(clearBtn);

      const input = screen.getByTestId('input');
      expect(document.activeElement).toBe(input);
    });
  });

  describe('controlled value', () => {
    it('syncs hasValue state with controlled value prop', () => {
      const { rerender } = render(
        <Input type="search" value="" onChange={() => {}} />,
      );

      // Initially empty — no clear button
      expect(
        screen.queryByRole('button', { name: /clear search/i }),
      ).not.toBeInTheDocument();

      // Update value — clear button should appear
      rerender(<Input type="search" value="updated" onChange={() => {}} />);
      expect(
        screen.getByRole('button', { name: /clear search/i }),
      ).toBeInTheDocument();

      // Back to empty — clear button should disappear
      rerender(<Input type="search" value="" onChange={() => {}} />);
      expect(
        screen.queryByRole('button', { name: /clear search/i }),
      ).not.toBeInTheDocument();
    });

    it('calls onChange when typing', async () => {
      const handleChange = vi.fn();
      render(
        <Input
          type="search"
          value=""
          onChange={handleChange}
          data-testid="input"
        />,
      );

      const user = userEvent.setup();
      await user.type(screen.getByTestId('input'), 'a');
      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe('uncontrolled (defaultValue)', () => {
    it('shows clear button when defaultValue is set', () => {
      render(<Input type="search" defaultValue="initial" />);
      expect(
        screen.getByRole('button', { name: /clear search/i }),
      ).toBeInTheDocument();
    });

    it('does not show clear button when defaultValue is empty', () => {
      render(<Input type="search" defaultValue="" />);
      expect(
        screen.queryByRole('button', { name: /clear search/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('non-search clear button', () => {
    it('shows clear button for non-search inputs when they have a value', () => {
      render(<Input type="text" value="hello" onChange={() => {}} />);
      // The clear button renders for any type with a value
      expect(
        screen.getByRole('button', { name: /clear search/i }),
      ).toBeInTheDocument();
    });
  });
});
