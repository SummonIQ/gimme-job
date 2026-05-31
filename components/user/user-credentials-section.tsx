'use client';

import { Eye, EyeOff, Globe, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
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

interface CredentialSummary {
  id: string;
  hostname: string;
  label: string | null;
  username: string;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  hostname: string;
  label: string;
  username: string;
  password: string;
  showPassword: boolean;
  editingId: string | null;
}

const EMPTY_FORM: FormState = {
  hostname: '',
  label: '',
  username: '',
  password: '',
  showPassword: false,
  editingId: null,
};

export function UserCredentialsSection() {
  const [credentials, setCredentials] = useState<CredentialSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/credentials')
      .then(response => {
        if (!response.ok) throw new Error('Failed to load credentials');
        return response.json();
      })
      .then((data: { credentials: CredentialSummary[] }) => {
        if (!cancelled) setCredentials(data.credentials);
      })
      .catch(error => {
        toast.error(
          error instanceof Error ? error.message : 'Failed to load credentials',
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function openForm(credential?: CredentialSummary) {
    if (credential) {
      setForm({
        hostname: credential.hostname,
        label: credential.label ?? '',
        username: credential.username,
        password: '',
        showPassword: false,
        editingId: credential.id,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const isEdit = form.editingId !== null;
      const url = isEdit
        ? `/api/credentials/${form.editingId}`
        : '/api/credentials';
      const method = isEdit ? 'PATCH' : 'POST';
      const body: Record<string, string | null | undefined> = {
        hostname: form.hostname,
        label: form.label.trim() || null,
        username: form.username,
      };
      // On edit, only send password if the user typed a new one.
      if (!isEdit || form.password.length > 0) {
        body.password = form.password;
      }
      const response = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to save credential');
      }
      const saved = data.credential as CredentialSummary;
      setCredentials(current => {
        const without = current.filter(item => item.id !== saved.id);
        return [...without, saved].sort((a, b) =>
          a.hostname === b.hostname
            ? a.username.localeCompare(b.username)
            : a.hostname.localeCompare(b.hostname),
        );
      });
      toast.success(isEdit ? 'Credential updated.' : 'Credential saved.');
      closeForm();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save credential',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(credential: CredentialSummary) {
    if (
      !confirm(
        `Delete saved login for ${credential.username} on ${credential.hostname}?`,
      )
    ) {
      return;
    }
    try {
      const response = await fetch(`/api/credentials/${credential.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to delete credential');
      }
      setCredentials(current =>
        current.filter(item => item.id !== credential.id),
      );
      toast.success('Credential deleted.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete credential',
      );
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Saved logins</CardTitle>
          <CardDescription>
            Stored encrypted with AES-256-GCM. Used by autofill to sign in to
            ATS sites and prefill username/password fields. Passwords are
            never returned to the browser after saving.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => openForm()}
          className="w-fit"
        >
          <Plus className="size-4" />
          Add login
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : credentials.length === 0 && !isFormOpen ? (
          <p className="text-sm text-muted-foreground">
            No saved logins yet. Add one to auto-fill sign-in fields.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {credentials.map(credential => (
              <li
                key={credential.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Globe className="size-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {credential.label || credential.hostname}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {credential.username} · {credential.hostname}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openForm(credential)}
                    className="w-fit"
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(credential)}
                    className="w-fit text-destructive"
                    aria-label={`Delete ${credential.username}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {isFormOpen ? (
          <form
            onSubmit={handleSubmit}
            className="mt-4 grid gap-4 rounded-md border border-border bg-muted/30 p-4"
          >
            <div className="grid gap-2">
              <Label htmlFor="credential-hostname">Site</Label>
              <Input
                id="credential-hostname"
                value={form.hostname}
                onChange={event =>
                  setForm(state => ({ ...state, hostname: event.target.value }))
                }
                placeholder="linkedin.com"
                autoComplete="off"
                required
              />
              <p className="text-xs text-muted-foreground">
                Domain only — paste a full URL and we'll strip it.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="credential-label">Label (optional)</Label>
              <Input
                id="credential-label"
                value={form.label}
                onChange={event =>
                  setForm(state => ({ ...state, label: event.target.value }))
                }
                placeholder="Personal LinkedIn"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="credential-username">Username or email</Label>
              <Input
                id="credential-username"
                value={form.username}
                onChange={event =>
                  setForm(state => ({ ...state, username: event.target.value }))
                }
                autoComplete="off"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="credential-password">
                Password
                {form.editingId
                  ? ' (leave blank to keep existing)'
                  : ''}
              </Label>
              <div className="relative">
                <Input
                  id="credential-password"
                  type={form.showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={event =>
                    setForm(state => ({
                      ...state,
                      password: event.target.value,
                    }))
                  }
                  autoComplete="new-password"
                  required={form.editingId === null}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() =>
                    setForm(state => ({
                      ...state,
                      showPassword: !state.showPassword,
                    }))
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={
                    form.showPassword ? 'Hide password' : 'Show password'
                  }
                >
                  {form.showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={closeForm}
                disabled={isSaving}
                className="w-fit"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} className="w-fit">
                {isSaving ? 'Saving…' : form.editingId ? 'Save' : 'Add login'}
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
