import React from 'react';
import { EmailLayout, EmailHeader, EmailContent, EmailButton, EmailFooter } from './base';
import type { ApplicationStatusNotificationMetadata } from '../types';

interface ApplicationStatusEmailProps {
  metadata: ApplicationStatusNotificationMetadata;
  recipientName?: string;
  baseUrl: string;
}

export function ApplicationStatusEmail({ metadata, recipientName, baseUrl }: ApplicationStatusEmailProps) {
  const { jobTitle, companyName, previousStatus, newStatus, jobLeadId } = metadata;

  const statusColors: Record<string, string> = {
    APPLIED: '#3b82f6',
    INTERVIEW_SCHEDULED: '#8b5cf6',
    INTERVIEWED: '#6366f1',
    OFFER_MADE: '#10b981',
    OFFER_ACCEPTED: '#059669',
    REJECTED: '#ef4444',
    WITHDRAWN: '#f59e0b'
  };

  const statusColor = statusColors[newStatus] || '#6b7280';

  return (
    <EmailLayout preheader={`Your application for ${jobTitle} at ${companyName} has been updated`}>
      <EmailHeader />
      <EmailContent>
        <h2 style={{ margin: '0 0 16px', fontSize: '20px', fontWeight: '600', color: '#1a202c' }}>
          Application Status Update
        </h2>

        <p style={{ margin: '0 0 16px' }}>
          {recipientName ? `Hi ${recipientName},` : 'Hi there,'}
        </p>

        <p style={{ margin: '0 0 24px' }}>
          Your application for <strong>{jobTitle}</strong> at <strong>{companyName}</strong> has been updated.
        </p>

        <table width="100%" cellPadding="16" cellSpacing="0" style={{ backgroundColor: '#f7fafc', borderRadius: '6px', marginBottom: '24px' }}>
          <tr>
            <td>
              <table width="100%" cellPadding="0" cellSpacing="0">
                <tr>
                  <td style={{ paddingBottom: '8px', fontSize: '14px', color: '#718096' }}>Previous Status:</td>
                </tr>
                <tr>
                  <td style={{ paddingBottom: '16px' }}>
                    <span style={{ padding: '4px 12px', backgroundColor: '#e2e8f0', color: '#475569', borderRadius: '4px', fontSize: '14px', fontWeight: '500' }}>
                      {previousStatus.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ paddingBottom: '8px', fontSize: '14px', color: '#718096' }}>New Status:</td>
                </tr>
                <tr>
                  <td>
                    <span style={{ padding: '4px 12px', backgroundColor: statusColor, color: '#ffffff', borderRadius: '4px', fontSize: '14px', fontWeight: '500' }}>
                      {newStatus.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <EmailButton href={`${baseUrl}/leads/${jobLeadId}`}>
          View Application Details
        </EmailButton>

        <p style={{ margin: '24px 0 0', fontSize: '14px', color: '#718096' }}>
          Keep track of all your applications in your dashboard.
        </p>
      </EmailContent>
      <EmailFooter unsubscribeUrl={`${baseUrl}/settings/notifications`} />
    </EmailLayout>
  );
}
