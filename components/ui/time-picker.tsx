'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface TimePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  className?: string;
}

export function TimePicker({ date, setDate, className }: TimePickerProps) {
  const minuteRef = React.useRef<HTMLInputElement>(null);
  const hourRef = React.useRef<HTMLInputElement>(null);

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hour = parseInt(e.target.value);
    if (!isNaN(hour) && hour >= 0 && hour <= 23 && date) {
      const newDate = new Date(date);
      newDate.setHours(hour);
      setDate(newDate);
    }
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const minute = parseInt(e.target.value);
    if (!isNaN(minute) && minute >= 0 && minute <= 59 && date) {
      const newDate = new Date(date);
      newDate.setMinutes(minute);
      setDate(newDate);
    }
  };

  return (
    <div className={cn('flex items-end gap-2', className)}>
      <div className="grid gap-1 text-center">
        <Label htmlFor="hours" className="text-xs">
          Hours
        </Label>
        <Input
          ref={hourRef}
          id="hours"
          type="number"
          min={0}
          max={23}
          value={date ? date.getHours().toString().padStart(2, '0') : '00'}
          onChange={handleHourChange}
          className="w-[48px]"
        />
      </div>
      <div className="grid gap-1 text-center">
        <Label htmlFor="minutes" className="text-xs">
          Minutes
        </Label>
        <Input
          ref={minuteRef}
          id="minutes"
          type="number"
          min={0}
          max={59}
          value={date ? date.getMinutes().toString().padStart(2, '0') : '00'}
          onChange={handleMinuteChange}
          className="w-[48px]"
        />
      </div>
    </div>
  );
}