import React from 'react';
import { EmailLayout, EmailHeader, EmailContent, EmailButton, EmailFooter } from './base';
import type { InterviewRequestNotificationMetadata } from '../types';

interface InterviewRequestEmailProps {
  metadata: InterviewRequestNotificationMetadata;
  recipientName?: string;
  baseUrl: string;
}

export function InterviewRequestEmail({ metadata, recipientName, baseUrl }: InterviewRequestEmailProps) {
  const { jobTitle, companyName, interviewDate, interviewType, interviewLocation, contactPerson, jobLeadId } = metadata;

  return (
    <EmailLayout preheader={`Interview request for ${jobTitle} at ${companyName}`}>
      <EmailHeader />
      <EmailContent>
        <h2 style={{ margin: '0 0 16px', fontSize: '20px', fontWeight: '600', color: '#1a202c' }}>
          🎉 Interview Request!
        </h2>

        <p style={{ margin: '0 0 16px' }}>
          {recipientName ? `Hi ${recipientName},` : 'Hi there,'}
        </p>

        <p style={{ margin: '0 0 24px' }}>
          Great news! You've received an interview request for <strong>{jobTitle}</strong> at <strong>{companyName}</strong>.
        </p>

        <table width="100%" cellPadding="16" cellSpacing="0" style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', marginBottom: '24px' }}>
          <tr>
            <td>
              <table width="100%" cellPadding="0" cellSpacing="0">
                <tr>
                  <td style={{ fontSize: '14px', color: '#065f46', paddingBottom: '12px' }}>
                    <strong>Position:</strong> {jobTitle}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontSize: '14px', color: '#065f46', paddingBottom: '12px' }}>
                    <strong>Company:</strong> {companyName}
                  </td>
                </tr>
                {interviewDate && (
                  <tr>
                    <td style={{ fontSize: '14px', color: '#065f46', paddingBottom: '12px' }}>
                      <strong>Date:</strong> {interviewDate}
                    </td>
                  </tr>
                )}
                {interviewType && (
                  <tr>
                    <td style={{ fontSize: '14px', color: '#065f46', paddingBottom: '12px' }}>
                      <strong>Type:</strong> {interviewType}
                    </td>
                  </tr>
                )}
                {interviewLocation && (
                  <tr>
                    <td style={{ fontSize: '14px', color: '#065f46', paddingBottom: '12px' }}>
                      <strong>Location:</strong> {interviewLocation}
                    </td>
                  </tr>
                )}
                {contactPerson && (
                  <tr>
                    <td style={{ fontSize: '14px', color: '#065f46' }}>
                      <strong>Contact:</strong> {contactPerson}
                    </td>
                  </tr>
                )}
              </table>
            </td>
          </tr>
        </table>

        <EmailButton href={`${baseUrl}/leads/${jobLeadId}`}>
          View Interview Details
        </EmailButton>

        <table width="100%" cellPadding="16" cellSpacing="0" style={{ backgroundColor: '#eff6ff', borderRadius: '6px', marginTop: '24px' }}>
          <tr>
            <td>
              <p style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: '600', color: '#1e40af' }}>
                💡 Interview Preparation Tips
              </p>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#1e40af' }}>
                <li style={{ marginBottom: '4px' }}>Research the company and role thoroughly</li>
                <li style={{ marginBottom: '4px' }}>Prepare examples of your past work</li>
                <li style={{ marginBottom: '4px' }}>Review common interview questions</li>
                <li>Have questions ready for the interviewer</li>
              </ul>
            </td>
          </tr>
        </table>
      </EmailContent>
      <EmailFooter unsubscribeUrl={`${baseUrl}/settings/notifications`} />
    </EmailLayout>
  );
}
