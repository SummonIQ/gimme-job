import {getRequestConfig} from 'next-intl/server';
 
export default getRequestConfig(async ({locale}) => {
  // Ensure locale is always a valid string
  const safeLocale = locale || 'en';
  
  return {
    locale: safeLocale,
    messages: (await import(`./messages/${safeLocale}/onboarding.json`)).default
  };
});
