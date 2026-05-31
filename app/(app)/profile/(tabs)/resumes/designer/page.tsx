import { redirect } from 'next/navigation';

import { createStructuredResume } from '@/lib/resumes/structured/actions';

interface DesignerEntryProps {
  searchParams: Promise<{ name?: string }>;
}

export const dynamic = 'force-dynamic';

export default async function ResumeDesignerEntryPage({
  searchParams,
}: DesignerEntryProps) {
  const { name } = await searchParams;
  const draftName =
    name?.trim() && name.trim().length > 0 ? name.trim() : 'New Resume';

  const { id } = await createStructuredResume({ name: draftName });
  redirect(`/profile/resumes/designer/${id}`);
}
