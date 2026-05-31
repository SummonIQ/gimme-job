import { notFound } from 'next/navigation';
import { ShareableDashboardClient } from './client';
import { ShareableDashboardManager } from '@/lib/exports/shareable-dashboards';

interface SharedDashboardPageProps {
  params: {
    token: string;
  };
  searchParams: {
    password?: string;
  };
}

export default async function SharedDashboardPage({
  params,
  searchParams
}: SharedDashboardPageProps) {
  const { token } = params;
  const { password } = searchParams;

  if (!token) {
    notFound();
  }

  const manager = new ShareableDashboardManager();

  try {
    // Validate access first
    const validation = await manager.validateAccess(token, {
      password,
      domain: typeof window !== 'undefined' ? window.location.hostname : undefined
    });

    if (!validation.valid && !validation.requiresPassword) {
      notFound();
    }

    // If password is required but not provided, show password form
    if (validation.requiresPassword && !password) {
      return <ShareableDashboardClient token={token} requiresPassword />;
    }

    // If password was provided but invalid
    if (validation.requiresPassword && validation.error) {
      return (
        <ShareableDashboardClient 
          token={token} 
          requiresPassword 
          error={validation.error}
        />
      );
    }

    // Get dashboard data
    const dashboardData = await manager.getShareableDashboard(token, {
      password,
      domain: typeof window !== 'undefined' ? window.location.hostname : undefined
    });

    return (
      <ShareableDashboardClient 
        token={token}
        dashboardData={dashboardData}
      />
    );
  } catch (error) {
    console.error('Error loading shared dashboard:', error);
    notFound();
  }
}