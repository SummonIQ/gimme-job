import React from 'react';

interface EmailLayoutProps {
  children: React.ReactNode;
  preheader?: string;
}

export function EmailLayout({ children, preheader }: EmailLayoutProps) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {preheader && (
          <style>
            {`
              .preheader {
                display: none;
                max-height: 0;
                max-width: 0;
                opacity: 0;
                overflow: hidden;
                mso-hide: all;
              }
            `}
          </style>
        )}
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#f6f9fc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
        {preheader && (
          <div className="preheader" style={{ display: 'none', maxHeight: 0, maxWidth: 0, opacity: 0, overflow: 'hidden' }}>
            {preheader}
          </div>
        )}
        <table width="100%" cellPadding="0" cellSpacing="0" style={{ backgroundColor: '#f6f9fc', padding: '40px 0' }}>
          <tr>
            <td align="center">
              <table width="600" cellPadding="0" cellSpacing="0" style={{ backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                {children}
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  );
}

interface EmailHeaderProps {
  logoUrl?: string;
}

export function EmailHeader({ logoUrl }: EmailHeaderProps) {
  return (
    <tr>
      <td style={{ padding: '40px 40px 20px', textAlign: 'center', borderBottom: '1px solid #e6e9ef' }}>
        {logoUrl ? (
          <img src={logoUrl} alt="Gimme Job" style={{ height: '40px', width: 'auto' }} />
        ) : (
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#1a202c' }}>Gimme Job</h1>
        )}
      </td>
    </tr>
  );
}

interface EmailContentProps {
  children: React.ReactNode;
}

export function EmailContent({ children }: EmailContentProps) {
  return (
    <tr>
      <td style={{ padding: '40px', color: '#4a5568', fontSize: '16px', lineHeight: '24px' }}>
        {children}
      </td>
    </tr>
  );
}

interface EmailButtonProps {
  href: string;
  children: React.ReactNode;
}

export function EmailButton({ href, children }: EmailButtonProps) {
  return (
    <table width="100%" cellPadding="0" cellSpacing="0" style={{ margin: '24px 0' }}>
      <tr>
        <td align="center">
          <a
            href={href}
            style={{
              display: 'inline-block',
              padding: '12px 32px',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              textDecoration: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '16px'
            }}
          >
            {children}
          </a>
        </td>
      </tr>
    </table>
  );
}

interface EmailFooterProps {
  unsubscribeUrl?: string;
}

export function EmailFooter({ unsubscribeUrl }: EmailFooterProps) {
  return (
    <tr>
      <td style={{ padding: '20px 40px', textAlign: 'center', borderTop: '1px solid #e6e9ef', backgroundColor: '#f7fafc' }}>
        <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#718096' }}>
          © {new Date().getFullYear()} Gimme Job. All rights reserved.
        </p>
        {unsubscribeUrl && (
          <p style={{ margin: 0, fontSize: '12px', color: '#a0aec0' }}>
            <a href={unsubscribeUrl} style={{ color: '#a0aec0', textDecoration: 'underline' }}>
              Unsubscribe from these emails
            </a>
          </p>
        )}
      </td>
    </tr>
  );
}
