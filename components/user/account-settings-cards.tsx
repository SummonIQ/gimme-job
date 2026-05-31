'use client';

import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth/client';

interface AccountSettingsCardsProps {
  readonly changeEmailAction: (email: string) => Promise<void>;
  readonly currentEmail: string;
}

export function AccountSettingsCards({
  changeEmailAction,
  currentEmail,
}: AccountSettingsCardsProps) {
  const router = useRouter();
  const [email, setEmail] = useState(currentEmail);
  const [currentPassword, setCurrentPassword] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const handleChangeEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsChangingEmail(true);

    try {
      await changeEmailAction(email);
      toast.success('Email updated.');
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to update email.',
      );
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsChangingPassword(true);

    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });

    if (error) {
      toast.error(error.message || 'Unable to reset password.');
      setIsChangingPassword(false);
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setIsChangingPassword(false);
    toast.success('Password reset.');
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="space-y-1.5">
            <CardTitle>Change Email</CardTitle>
            <CardDescription>
              Update the email address used to sign in.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleChangeEmail}>
            <div className="space-y-2">
              <Label htmlFor="account-email">Email address</Label>
              <Input
                autoComplete="email"
                disabled={isChangingEmail}
                id="account-email"
                onChange={event => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </div>
            <Button disabled={isChangingEmail} type="submit">
              {isChangingEmail ? 'Saving' : 'Save email'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="space-y-1.5">
            <CardTitle>Reset Password</CardTitle>
            <CardDescription>
              Set a new password for your account.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleChangePassword}>
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                autoComplete="current-password"
                disabled={isChangingPassword}
                id="current-password"
                onChange={event => setCurrentPassword(event.target.value)}
                type="password"
                value={currentPassword}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                autoComplete="new-password"
                disabled={isChangingPassword}
                id="new-password"
                minLength={8}
                onChange={event => setNewPassword(event.target.value)}
                type="password"
                value={newPassword}
              />
            </div>
            <Button disabled={isChangingPassword} type="submit">
              {isChangingPassword ? 'Saving' : 'Reset password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
