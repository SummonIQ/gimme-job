import Link from 'next/link';
import { redirect } from 'next/navigation';

import LoginForm from '@/components/auth/login-form';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getSessionUser } from '@/lib/user/query';
// import { getSessionUser } from '@/lib/user/query';

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const user = await getSessionUser();
  const urlSearchParams = await searchParams;

  if (user) {
    return redirect(urlSearchParams?.redirect_url ?? '/dashboard');
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-12 md:items-center lg:px-8">
      <Card className="w-full max-w-96 grow-0 rounded-lg sm:w-3/6 md:w-2/5 lg:w-1/3 xl:w-1/4 2xl:w-1/5">
        <CardHeader className="flex w-full flex-col items-center justify-center space-y-2 text-center">
          <span className="rounded-full border border-border/50 bg-accent/30 px-4 py-2">
            Gimme Job
          </span>

          <CardTitle className="items-center justify-center text-center">
            Login to your account
          </CardTitle>
        </CardHeader>

        <CardContent className="bg-secondary/20">
          <LoginForm
            isLoggedIn={Boolean(user)}
            redirectUrl={urlSearchParams?.redirect_url ?? '/dashboard'}
          />
        </CardContent>
        <CardFooter className="flex items-center justify-center border-t border-t-border p-3">
          <p className="text-center text-sm text-muted-foreground">
            Not a member?{' '}
            <Link
              className="font-semibold text-primary no-underline underline-offset-4 hover:underline"
              href="/signup"
            >
              Sign up now!
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
