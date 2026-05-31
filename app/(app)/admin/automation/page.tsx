import { redirect } from 'next/navigation';

// Automation page removed — relevant metrics live on Dashboard and Applications.
export default function AdminAutomationPage() {
  redirect('/admin');
}
