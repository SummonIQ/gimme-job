'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useAnalytics } from '@summoniq/signalsplash-client-sdk/react';

import { Button } from '@/components/ui/button';
import { FormErrorSummary } from '@/components/forms/form-error-summary';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useFormErrorHandling } from '@/lib/a11y/form-utils';
import { authClient } from '@/lib/auth/client';
import { cn } from '@/lib/utils';

import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const loginFormSchema = z.object({
  emailAddress: z
    .string({ error: 'Email address is required' })
    .email({ message: 'Enter a valid email address' }),
  password: z
    .string({ error: 'Password is required' })
    .min(1, { message: 'Password is required' }),
});

export default function LoginForm({
  redirectUrl,
  className,
  isLoggedIn,
}: {
  className?: string;
  isLoggedIn?: boolean;
  redirectUrl?: string;
}) {
  const form = useForm<z.infer<typeof loginFormSchema>>({
    defaultValues: {
      emailAddress: '',
      password: '',
    },
    resolver: zodResolver(loginFormSchema),
  });
  const [error, setError] = useState<string | undefined>();
  const [inProgress, setInProgress] = useState(false);
  const router = useRouter();
  const { identify, track } = useAnalytics();
  const {
    errorEntries,
    errorSummaryRef,
    focusField,
    handleInvalid,
    showSummary,
  } = useFormErrorHandling(form);

  // Only redirect once when logged in status changes to true
  useEffect(() => {
    if (!isLoggedIn) return;

    console.log('Login status: logged in, redirectUrl:', redirectUrl);

    // Redirect after a short delay to allow for any state updates
    const redirectTimeout = setTimeout(() => {
      // Determine the correct redirect path
      let targetPath = '/dashboard';

      // Use redirectUrl if provided and valid
      if (
        redirectUrl &&
        typeof window !== 'undefined' &&
        !redirectUrl.includes('/login')
      ) {
        targetPath = redirectUrl;
      }

      console.log('Redirecting after login to:', targetPath);
      router.push(targetPath);
    }, 300); // Increased delay for better stability

    return () => clearTimeout(redirectTimeout);
  }, [isLoggedIn, redirectUrl, router]);

  async function onSubmit(values: z.infer<typeof loginFormSchema>) {
    setError(undefined);
    setInProgress(true);

    const { emailAddress, password } = values;

    const { data, error } = await authClient.signIn.email({
      email: emailAddress,
      password,
    });

    if (error) {
      setError('Invalid email or password. Please try again.');
      setInProgress(false);
      track('login_failed', {
        reason: 'invalid_credentials',
      });
    } else {
      // Handle successful login
      setInProgress(false);
      if (data?.user?.id) {
        identify(data.user.id, {
          email: data.user.email,
          name: data.user.name,
        });
      }
      track('login_success', {
        method: 'email',
      });

      // If redirectUrl is specified AND it's different from the current URL, redirect to it
      if (
        redirectUrl &&
        typeof window !== 'undefined' &&
        window.location.pathname !== redirectUrl
      ) {
        router.push(redirectUrl);
      } else {
        // Otherwise just refresh the current page
        // router.refresh();
      }
    }
  }

  if (isLoggedIn) {
    return (
      <div className="text-center">
        <p>You are already signed in.</p>
      </div>
    );
  }

  const onInvalid = (errors: typeof form.formState.errors) => {
    handleInvalid(errors);
  };

  return (
    <Form {...form}>
      <form
        className={cn('', className)}
        onSubmit={form.handleSubmit(onSubmit, onInvalid)}
        noValidate
      >
        <FormErrorSummary
          errors={errorEntries}
          heading="We couldn't sign you in yet. Fix the fields below:"
          onSelect={focusField}
          ref={errorSummaryRef}
          visible={showSummary}
        />
        {error && (
          <Alert className="mb-6" variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mb-5 flex flex-col space-y-5">
          <FormField
            control={form.control}
            name="emailAddress"
            render={({ field }) => (
              <FormItem className="space-y-1">
                <FormLabel>Email address</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="email" type="email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="space-y-1">
                <div className="flex flex-row items-center justify-between">
                  <FormLabel className="flex w-auto grow">Password</FormLabel>

                  <Link
                    className="text-right font-semibold text-primary text-sm no-underline underline-offset-4 hover:underline"
                    href="#"
                  >
                    Forgot password?
                  </Link>
                </div>

                <FormControl>
                  <Input
                    {...field}
                    autoComplete="current-password"
                    type="password"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button
          className="flex w-full cursor-pointer justify-center"
          disabled={inProgress}
          type="submit"
        >
          Sign in
        </Button>
      </form>
    </Form>
  );
}
