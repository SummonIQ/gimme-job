'use client';

import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

export const jobSearchFormSchema = z.object({
  location: z.string().optional(),
  remote: z.boolean().optional(),
  searchTerm: z.string().min(2, {
    message: 'You must enter a search term.',
  }),
});

export function JobSearchForm({
  form,
}: {
  form: UseFormReturn<
    z.infer<typeof jobSearchFormSchema>,
    undefined,
    undefined
  >;
}) {
  const remoteWatch = form.watch('remote');

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-row gap-4">
        <FormField
          control={form.control}
          name="searchTerm"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Search Term</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              {/* <FormDescription>
                Select a job board to scrape job listings from.
              </FormDescription> */}
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="flex space-x-8">
        <FormField
          control={form.control}
          name="remote"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Remote</FormLabel>
              <FormControl className="flex grow items-center">
                <Switch
                  defaultChecked={field.value}
                  onCheckedChange={e => {
                    const value = e.valueOf();
                    form.setValue('remote', value);
                    if (value) {
                      form.setValue('location', '');
                    }
                    field.onChange(value);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem className="max-w-64 flex-1">
              <FormLabel>Location</FormLabel>
              <FormControl>
                <Input disabled={remoteWatch === true} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Work+from+Home%2FRemote */}
      </div>

      {/* <Separator /> */}
      <div className="flex space-x-4">
        {/* <FormField
          control={form.control}
          name="startPage"
          render={({ field }) => (
            <FormItem className="max-w-[80px]">
              <FormLabel>Start Page</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  onChange={e => {
                    field.onChange(Number.parseInt(e.target.value));
                  }}
                  type="number"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="endPage"
          render={({ field }) => (
            <FormItem className="max-w-[80px]">
              <FormLabel>End Page</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  onChange={e => {
                    field.onChange(Number.parseInt(e.target.value));
                  }}
                  type="number"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="pageDelay"
          render={({ field }) => (
            <FormItem className="max-w-[130px]">
              <FormLabel>Page Delay</FormLabel>
              <FormControl>
                <Select
                  {...field}
                  defaultValue="5000"
                  onValueChange={val => field.onChange(val)}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue
                      defaultValue={field.value}
                      placeholder="Page Delay (seconds)"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1000">1 second</SelectItem>
                    <SelectItem value="5000">5 seconds</SelectItem>
                    <SelectItem value="10000">10 seconds</SelectItem>
                    <SelectItem value="15000">15 seconds</SelectItem>
                    <SelectItem value="30000">30 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        /> */}
      </div>
    </div>
  );
}
