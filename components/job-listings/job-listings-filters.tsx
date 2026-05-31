'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Filter, X, Search } from 'lucide-react';
import { format } from 'date-fns';
import { JobListingStatus } from '@/generated/prisma/browser';
import { cn } from '@/lib/utils';

export interface JobListingsFilters {
  status?: JobListingStatus[];
  jobType?: string[];
  experienceLevel?: string[];
  salaryMin?: number;
  salaryMax?: number;
  datePosted?: Date;
  remote?: boolean;
  saved?: boolean;
  companies?: string[];
  locations?: string[];
  keywords?: string;
}

interface JobListingsFiltersProps {
  filters: JobListingsFilters;
  onFiltersChange: (filters: JobListingsFilters) => void;
  onReset: () => void;
  className?: string;
}

const jobTypes = [
  { value: 'fulltime', label: 'Full-time' },
  { value: 'parttime', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'temporary', label: 'Temporary' },
];

const experienceLevels = [
  { value: 'entry', label: 'Entry Level' },
  { value: 'mid', label: 'Mid Level' },
  { value: 'senior', label: 'Senior Level' },
  { value: 'lead', label: 'Lead' },
  { value: 'manager', label: 'Manager' },
];

const datePostedOptions = [
  { value: '1', label: 'Last 24 hours' },
  { value: '3', label: 'Last 3 days' },
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
];

export function JobListingsFilters({
  filters,
  onFiltersChange,
  onReset,
  className,
}: JobListingsFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [salaryRange, setSalaryRange] = useState<[number, number]>([
    filters.salaryMin || 0,
    filters.salaryMax || 300000,
  ]);

  const activeFilterCount = Object.values(filters).filter(
    (value) => value !== undefined && value !== null && 
    (Array.isArray(value) ? value.length > 0 : true)
  ).length;

  const handleStatusToggle = (status: JobListingStatus) => {
    const currentStatuses = filters.status || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter((s) => s !== status)
      : [...currentStatuses, status];
    onFiltersChange({ ...filters, status: newStatuses });
  };

  const handleJobTypeToggle = (type: string) => {
    const currentTypes = filters.jobType || [];
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter((t) => t !== type)
      : [...currentTypes, type];
    onFiltersChange({ ...filters, jobType: newTypes });
  };

  const handleExperienceToggle = (level: string) => {
    const currentLevels = filters.experienceLevel || [];
    const newLevels = currentLevels.includes(level)
      ? currentLevels.filter((l) => l !== level)
      : [...currentLevels, level];
    onFiltersChange({ ...filters, experienceLevel: newLevels });
  };

  const handleSalaryChange = (value: number[]) => {
    setSalaryRange(value as [number, number]);
    onFiltersChange({
      ...filters,
      salaryMin: value[0],
      salaryMax: value[1],
    });
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Filters</h3>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFilterCount} active
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-xs"
        >
          Reset all
        </Button>
      </div>

      <div className="space-y-4">
        {/* Status Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Status</Label>
          <div className="flex flex-wrap gap-2">
            {Object.values(JobListingStatus).map((status) => (
              <Badge
                key={status}
                variant={filters.status?.includes(status) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => handleStatusToggle(status)}
              >
                {status.replace('_', ' ')}
              </Badge>
            ))}
          </div>
        </div>

        {/* Job Type Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Job Type</Label>
          <div className="flex flex-wrap gap-2">
            {jobTypes.map((type) => (
              <Badge
                key={type.value}
                variant={filters.jobType?.includes(type.value) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => handleJobTypeToggle(type.value)}
              >
                {type.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Remote Filter */}
        <div className="flex items-center space-x-2">
          <Switch
            id="remote"
            checked={filters.remote || false}
            onCheckedChange={(checked) =>
              onFiltersChange({ ...filters, remote: checked })
            }
          />
          <Label htmlFor="remote" className="text-sm font-medium cursor-pointer">
            Remote positions only
          </Label>
        </div>

        {/* Saved Filter */}
        <div className="flex items-center space-x-2">
          <Switch
            id="saved"
            checked={filters.saved || false}
            onCheckedChange={(checked) =>
              onFiltersChange({ ...filters, saved: checked })
            }
          />
          <Label htmlFor="saved" className="text-sm font-medium cursor-pointer">
            Saved jobs only
          </Label>
        </div>

        {/* Advanced Filters */}
        <Accordion type="single" collapsible>
          <AccordionItem value="advanced" className="border-none">
            <AccordionTrigger className="text-sm font-medium py-2">
              Advanced Filters
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              {/* Experience Level */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Experience Level</Label>
                <div className="flex flex-wrap gap-2">
                  {experienceLevels.map((level) => (
                    <Badge
                      key={level.value}
                      variant={
                        filters.experienceLevel?.includes(level.value)
                          ? 'default'
                          : 'outline'
                      }
                      className="cursor-pointer"
                      onClick={() => handleExperienceToggle(level.value)}
                    >
                      {level.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Salary Range */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Salary Range</Label>
                <div className="px-2">
                  <Slider
                    min={0}
                    max={300000}
                    step={5000}
                    value={salaryRange}
                    onValueChange={handleSalaryChange}
                    className="mb-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>${salaryRange[0].toLocaleString()}</span>
                    <span>${salaryRange[1].toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Date Posted */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Date Posted</Label>
                <Select
                  value={
                    filters.datePosted
                      ? Math.floor(
                          (new Date().getTime() - filters.datePosted.getTime()) /
                            (1000 * 60 * 60 * 24)
                        ).toString()
                      : undefined
                  }
                  onValueChange={(value) => {
                    const date = new Date();
                    date.setDate(date.getDate() - parseInt(value));
                    onFiltersChange({ ...filters, datePosted: date });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Any time" />
                  </SelectTrigger>
                  <SelectContent>
                    {datePostedOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Keywords */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Keywords</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search in title or description..."
                    value={filters.keywords || ''}
                    onChange={(e) =>
                      onFiltersChange({ ...filters, keywords: e.target.value })
                    }
                    className="pl-8"
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}