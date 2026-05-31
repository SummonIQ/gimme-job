import { z } from 'zod';

import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

import { AccountSettingsCards } from '@/components/user/account-settings-cards';

const changeEmailSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
});

export default async function Settings() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Account</h3>
        <p className="text-sm text-muted-foreground">
          Manage sign-in credentials for your Gimme Job account.
        </p>
      </div>

      <AccountSettingsCards
        changeEmailAction={async email => {
          'use server';

          const { email: nextEmail } = changeEmailSchema.parse({ email });
          const existingUser = await db.user.findUnique({
            select: { id: true },
            where: { email: nextEmail },
          });

          if (existingUser && existingUser.id !== user.id) {
            throw new Error('That email address is already in use.');
          }

          await db.user.update({
            data: {
              email: nextEmail,
              emailVerified: false,
            },
            where: { id: user.id },
          });
        }}
        currentEmail={user.email}
      />
    </div>
  );
}
