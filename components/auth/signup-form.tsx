'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
// import { ProgressIndicator } from '../progress/progress-indicator';
// import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
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
import { cn } from '@/lib/css';

import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const signupFormSchema = z.object({
  emailAddress: z
    .string({ required_error: 'Email address is required.' })
    .email({ message: 'Enter a valid email address.' }),
  firstName: z
    .string({ required_error: 'First name is required.' })
    .min(1, { message: 'First name is required.' }),
  lastName: z
    .string({ required_error: 'Last name is required.' })
    .min(1, { message: 'Last name is required.' }),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(8, { message: 'Password must be at least 8 characters long.' }),
});

export function SignupForm({
  emailAddress,
  className,
  redirectUrl,
  // onSignup,
  // isLoggedIn,
}: {
  className?: string;
  emailAddress?: string;
  isLoggedIn?: boolean;
  // onSignup: (data: {
  //   emailAddress: string;
  //   firstName: string;
  //   lastName: string;
  //   password: string;
  // }) => Promise<{
  //   emailAddress: string;
  //   firstName: string;
  //   id: string;
  //   lastName: string;
  // }>;
  redirectUrl?: string;
}) {
  const form = useForm<z.infer<typeof signupFormSchema>>({
    defaultValues: {
      emailAddress: '',
      firstName: '',
      lastName: '',
      password: '',
    },
    resolver: zodResolver(signupFormSchema),
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

  // useEffect(() => {
  //   if (isLoggedIn) {
  //     router.push(redirectUrl ?? '/dashboard');
  //   }
  // }, [isLoggedIn, redirectUrl, router]);
  const getErrorMessage = ({
    code,
    message,
  }: {
    code?: string | undefined;
    message?: string | undefined;
    status: number;
    statusText: string;
  }) => {
    if (code === 'USER_ALREADY_EXISTS') {
      return 'Email already exists';
    }
    return message;
  };

  async function onSubmit({
    emailAddress,
    firstName,
    lastName,
    password,
  }: z.infer<typeof signupFormSchema>) {
    setError(undefined);
    setInProgress(true);

    const signUpInput = {
      email: emailAddress,
      image: '/images/avatar.png',
      name: `${firstName} ${lastName}`.trim(),
      password,
      firstName,
      lastName,
    } satisfies Parameters<typeof authClient.signUp.email>[0];

    const { data, error } = await authClient.signUp.email(signUpInput);

    if (error) {
      setError(getErrorMessage(error));
      setInProgress(false);
      track('signup_failed', {
        reason: error.code ?? 'unknown',
      });
    } else {
      if (data?.user?.id) {
        identify(data.user.id, {
          email: data.user.email,
          firstName,
          lastName,
          name: `${firstName} ${lastName}`.trim(),
        });
      }
      track('signup_completed', {
        method: 'email',
      });
      // Set flag to trigger onboarding flow after login
      if (typeof window !== 'undefined') {
        localStorage.setItem('isNewUser', 'true');
        console.log('[Signup] Set isNewUser flag for onboarding');
      }
      router.push(redirectUrl ?? '/login');
    }
  }

  return (
    <Form {...form}>
      <form
        className={cn('gap-y-6', className)}
        noValidate
        onSubmit={form.handleSubmit(onSubmit, handleInvalid)}
      >
        <FormErrorSummary
          errors={errorEntries}
          heading="We need a bit more information before creating your account:"
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
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-600">First name</FormLabel>

                <FormControl>
                  <Input
                    {...field}
                    autoComplete="given-name"
                    className="bg-white border-muted/60 focus-visible:ring-offset-white [&:-webkit-autofill]:[box-shadow:0_0_0_1000px_white_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#0f172a]"
                    type="text"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-600">Last name</FormLabel>

                <FormControl>
                  <Input
                    {...field}
                    autoComplete="family-name"
                    className="bg-white border-muted/60 focus-visible:ring-offset-white [&:-webkit-autofill]:[box-shadow:0_0_0_1000px_white_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#0f172a]"
                    type="text"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="emailAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-600">Email address</FormLabel>

                <FormControl>
                  <Input
                    {...field}
                    autoComplete="email"
                    className="bg-white border-muted/60 focus-visible:ring-offset-white [&:-webkit-autofill]:[box-shadow:0_0_0_1000px_white_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#0f172a]"
                    defaultValue={emailAddress}
                    disabled={Boolean(emailAddress)}
                    type="email"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-600">Password</FormLabel>

                <FormControl>
                  <Input
                    {...field}
                    autoComplete="new-password"
                    className="bg-white border-muted/60 focus-visible:ring-offset-white [&:-webkit-autofill]:[box-shadow:0_0_0_1000px_white_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#0f172a]"
                    type="password"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button
          className="flex w-full justify-center py-6 text-base md:py-4 md:text-sm"
          disabled={inProgress}
          type="submit"
        >
          {inProgress ? 'Signing up...' : 'Sign up'}
        </Button>
      </form>
    </Form>
  );
}
