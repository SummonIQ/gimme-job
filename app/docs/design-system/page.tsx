import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

const foundations = [
  {
    id: 'colors',
    title: 'Colors',
    description: 'Color palette and theme tokens',
    href: '#',
  },
  {
    id: 'typography',
    title: 'Typography',
    description: 'Font scales, weights, and line heights',
    href: '#',
  },
  {
    id: 'spacing',
    title: 'Spacing',
    description: 'Spacing scale and layout tokens',
    href: '#',
  },
];

const componentCategories = [
  {
    id: 'ui-components',
    title: 'UI Components',
    description: 'Core interface components for building layouts',
    items: [
      { id: 'button', title: 'Button', href: '#' },
      { id: 'card', title: 'Card', href: '#' },
      { id: 'input', title: 'Input', href: '#' },
      { id: 'select', title: 'Select', href: '#' },
      { id: 'checkbox', title: 'Checkbox', href: '#' },
      { id: 'tabs', title: 'Tabs', href: '#' },
    ],
  },
  {
    id: 'data-display',
    title: 'Data Display',
    description: 'Components for displaying data and content',
    items: [
      { id: 'badges', title: 'Status Badges', href: '/docs/design-system/badges' },
      { id: 'table', title: 'Table', href: '/docs/components/table' },
      { id: 'report', title: 'Report', href: '/docs/components/report' },
    ],
  },
  {
    id: 'feedback',
    title: 'Feedback & Progress',
    description: 'Components for showing progress and status',
    items: [
      { id: 'progress', title: 'Progress Tracker', href: '/docs/design-system/progress' },
    ],
  },
];

export default function DesignSystemHome() {
  return (
    <div className="space-y-12">
      <header className="space-y-4">
        <Badge variant="outline">Design System</Badge>
        <h1 className="text-4xl font-bold">Gimme Job Design System</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Browse foundational tokens and documented interface components. Each entry includes
          live examples, guidance, and copy-ready code patterns.
        </p>
      </header>

      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Foundations</h2>
          <p className="text-sm text-muted-foreground">
            Start with typography, color, and spacing tokens before diving into component
            categories.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {foundations.map(item => (
            <Card className="p-6" key={item.id}>
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{item.description}</p>
              <Link
                className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                href={item.href}
              >
                View guidelines
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Component Categories</h2>
          <p className="text-sm text-muted-foreground">
            Explore component documentation and examples organized by category.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {componentCategories.map(category => (
            <Card className="p-6" key={category.id}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">{category.title}</h3>
                <Badge variant="outline">{category.items.length} docs</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{category.description}</p>
              <div className="border rounded-md divide-y">
                {category.items.map(item => (
                  <Link
                    className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors"
                    href={item.href}
                    key={item.id}
                  >
                    <span>{item.title}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
