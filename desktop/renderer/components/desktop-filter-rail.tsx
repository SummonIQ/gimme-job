import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface DesktopRandomFilters {
  readonly ats: 'greenhouse' | 'lever' | 'workday' | 'any';
  readonly searchLocation: string;
  readonly searchRemote: boolean;
  readonly searchTitle: string;
}

interface DesktopFilterRailProps {
  readonly filters: DesktopRandomFilters;
  readonly isOpen: boolean;
  readonly onChange: (filters: DesktopRandomFilters) => void;
  readonly onClose: () => void;
}

export function DesktopFilterRail({
  filters,
  isOpen,
  onChange,
  onClose,
}: DesktopFilterRailProps) {
  if (!isOpen) return null;

  const update = <Key extends keyof DesktopRandomFilters>(
    key: Key,
    value: DesktopRandomFilters[Key],
  ) => onChange({ ...filters, [key]: value });

  return (
    <aside
      aria-label="Search filters"
      className="desktop-filter-rail"
      role="complementary"
    >
      <div className="desktop-filter-rail-header">
        <span>Filters</span>
        <Button
          aria-label="Close filters"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="size-6"
        >
          <X aria-hidden="true" className="size-3.5" />
        </Button>
      </div>

      <div className="desktop-filter-rail-section">
        <Label htmlFor="filter-ats">ATS</Label>
        <Select
          value={filters.ats}
          onValueChange={value =>
            update('ats', value as DesktopRandomFilters['ats'])
          }
        >
          <SelectTrigger id="filter-ats" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            <SelectItem value="greenhouse">Greenhouse</SelectItem>
            <SelectItem value="lever">Lever (training preview)</SelectItem>
            <SelectItem value="workday">Workday (training preview)</SelectItem>
          </SelectContent>
        </Select>
        {filters.ats !== 'greenhouse' && filters.ats !== 'any' ? (
          <p className="desktop-filter-rail-note">
            Greenhouse is the only ATS wired to the runtime today. Other ATS
            picks return a random listing but submission falls back to manual
            review.
          </p>
        ) : null}
      </div>

      <div className="desktop-filter-rail-section">
        <Label htmlFor="filter-title">Title</Label>
        <Input
          id="filter-title"
          size="sm"
          onChange={event => update('searchTitle', event.target.value)}
          placeholder="software engineer"
          value={filters.searchTitle}
        />
      </div>

      <div className="desktop-filter-rail-section">
        <Label className="desktop-filter-rail-checkbox">
          <Checkbox
            checked={filters.searchRemote}
            onCheckedChange={checked => {
              const remote = checked === true;
              onChange({
                ...filters,
                searchLocation: remote ? '' : filters.searchLocation,
                searchRemote: remote,
              });
            }}
          />
          <span>Fully remote</span>
        </Label>
      </div>

      <div className="desktop-filter-rail-section">
        <Label htmlFor="filter-location">Location</Label>
        <Input
          id="filter-location"
          size="sm"
          disabled={filters.searchRemote}
          onChange={event => update('searchLocation', event.target.value)}
          placeholder="San Francisco"
          value={filters.searchLocation}
        />
      </div>
    </aside>
  );
}
