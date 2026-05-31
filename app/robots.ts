import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'https://www.gimmejob.com';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard/', '/admin/', '/settings/', '/profile/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
