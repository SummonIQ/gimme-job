import { db } from '@/lib/db/client';
import { exportUserData, type ExportFormat, type DataType } from './data-exporter';
import { sendEmail } from '@/lib/email';
import { getCurrentUser } from '@/lib/user/query';

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export interface ScheduledReportConfig {
  id?: string;
  name: string;
  description?: string;
  frequency: ScheduleFrequency;
  format: ExportFormat;
  dataType: DataType;
  includeCharts: boolean;
  includeSummary: boolean;
  includeDetails: boolean;
  customFields?: string[];
  filters?: Record<string, any>;
  emailRecipients: string[];
  isActive: boolean;
  nextRun?: Date;
  lastRun?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ScheduledReportsManager {
  /**
   * Create a new scheduled report
   */
  async createScheduledReport(config: Omit<ScheduledReportConfig, 'id' | 'nextRun' | 'lastRun' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const user = await getCurrentUser();
    
    const nextRun = this.calculateNextRun(config.frequency);
    
    const report = await db.scheduledReport.create({
      data: {
        userId: user.id,
        name: config.name,
        description: config.description,
        frequency: config.frequency,
        format: config.format,
        dataType: config.dataType,
        includeCharts: config.includeCharts,
        includeSummary: config.includeSummary,
        includeDetails: config.includeDetails,
        customFields: config.customFields || [],
        filters: config.filters || {},
        emailRecipients: config.emailRecipients,
        isActive: config.isActive,
        nextRun,
      }
    });

    return report.id;
  }

  /**
   * Update an existing scheduled report
   */
  async updateScheduledReport(id: string, updates: Partial<ScheduledReportConfig>): Promise<void> {
    const user = await getCurrentUser();
    
    const updateData: any = {
      ...updates,
      updatedAt: new Date(),
    };

    // Recalculate next run if frequency changed
    if (updates.frequency) {
      updateData.nextRun = this.calculateNextRun(updates.frequency);
    }

    await db.scheduledReport.update({
      where: {
        id,
        userId: user.id,
      },
      data: updateData,
    });
  }

  /**
   * Delete a scheduled report
   */
  async deleteScheduledReport(id: string): Promise<void> {
    const user = await getCurrentUser();
    
    await db.scheduledReport.delete({
      where: {
        id,
        userId: user.id,
      },
    });
  }

  /**
   * Get user's scheduled reports
   */
  async getUserScheduledReports(): Promise<ScheduledReportConfig[]> {
    const user = await getCurrentUser();
    
    const reports = await db.scheduledReport.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return reports.map(report => ({
      id: report.id,
      name: report.name,
      description: report.description || undefined,
      frequency: report.frequency as ScheduleFrequency,
      format: report.format as ExportFormat,
      dataType: report.dataType as DataType,
      includeCharts: report.includeCharts,
      includeSummary: report.includeSummary,
      includeDetails: report.includeDetails,
      customFields: report.customFields as string[],
      filters: report.filters as Record<string, any>,
      emailRecipients: report.emailRecipients as string[],
      isActive: report.isActive,
      nextRun: report.nextRun || undefined,
      lastRun: report.lastRun || undefined,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    }));
  }

  /**
   * Get reports that are due to run
   */
  async getDueReports(): Promise<ScheduledReportConfig[]> {
    const now = new Date();
    
    const reports = await db.scheduledReport.findMany({
      where: {
        isActive: true,
        nextRun: {
          lte: now,
        },
      },
      include: {
        user: true,
      },
    });

    return reports.map(report => ({
      id: report.id,
      name: report.name,
      description: report.description || undefined,
      frequency: report.frequency as ScheduleFrequency,
      format: report.format as ExportFormat,
      dataType: report.dataType as DataType,
      includeCharts: report.includeCharts,
      includeSummary: report.includeSummary,
      includeDetails: report.includeDetails,
      customFields: report.customFields as string[],
      filters: report.filters as Record<string, any>,
      emailRecipients: report.emailRecipients as string[],
      isActive: report.isActive,
      nextRun: report.nextRun || undefined,
      lastRun: report.lastRun || undefined,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    }));
  }

  /**
   * Execute a scheduled report
   */
  async executeScheduledReport(reportId: string): Promise<void> {
    const report = await db.scheduledReport.findUnique({
      where: { id: reportId },
      include: { user: true },
    });

    if (!report || !report.isActive) {
      throw new Error('Report not found or inactive');
    }

    try {
      // Calculate date range based on frequency
      const dateRange = this.getDateRangeForFrequency(report.frequency as ScheduleFrequency);

      // Generate the export
      const buffer = await exportUserData({
        format: report.format as ExportFormat,
        dataType: report.dataType as DataType,
        dateRange,
        includeCharts: report.includeCharts,
        includeSummary: report.includeSummary,
        includeDetails: report.includeDetails,
        customFields: report.customFields as string[],
        filters: report.filters as Record<string, any>,
      });

      // Send email with attachment
      await this.sendReportEmail(report, buffer);

      // Update the report's run times
      const nextRun = this.calculateNextRun(report.frequency as ScheduleFrequency);
      await db.scheduledReport.update({
        where: { id: reportId },
        data: {
          lastRun: new Date(),
          nextRun,
        },
      });

      console.log(`Scheduled report ${report.name} executed successfully`);
    } catch (error) {
      console.error(`Failed to execute scheduled report ${report.name}:`, error);
      
      // Log the error but don't fail the entire process
      await this.logReportError(reportId, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Send report via email
   */
  private async sendReportEmail(report: any, buffer: Buffer): Promise<void> {
    const fileName = `${report.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.${report.format === 'excel' ? 'xlsx' : report.format}`;
    
    const emailContent = `
      <h2>Scheduled Report: ${report.name}</h2>
      <p>Your scheduled report has been generated and is attached to this email.</p>
      
      <h3>Report Details:</h3>
      <ul>
        <li><strong>Report Name:</strong> ${report.name}</li>
        <li><strong>Frequency:</strong> ${report.frequency}</li>
        <li><strong>Data Type:</strong> ${report.dataType}</li>
        <li><strong>Format:</strong> ${report.format.toUpperCase()}</li>
        <li><strong>Generated:</strong> ${new Date().toLocaleString()}</li>
      </ul>
      
      ${report.description ? `<p><strong>Description:</strong> ${report.description}</p>` : ''}
      
      <p>This is an automated email from your job search analytics system.</p>
    `;

    for (const recipient of report.emailRecipients) {
      await sendEmail({
        to: recipient,
        subject: `Scheduled Report: ${report.name}`,
        html: emailContent,
        attachments: [
          {
            filename: fileName,
            content: buffer,
          },
        ],
      });
    }
  }

  /**
   * Calculate next run time based on frequency
   */
  private calculateNextRun(frequency: ScheduleFrequency): Date {
    const now = new Date();
    const nextRun = new Date(now);

    switch (frequency) {
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        nextRun.setHours(9, 0, 0, 0); // 9 AM next day
        break;
      case 'weekly':
        nextRun.setDate(nextRun.getDate() + 7);
        nextRun.setHours(9, 0, 0, 0); // 9 AM same day next week
        break;
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1);
        nextRun.setDate(1); // First day of next month
        nextRun.setHours(9, 0, 0, 0); // 9 AM
        break;
      case 'quarterly':
        nextRun.setMonth(nextRun.getMonth() + 3);
        nextRun.setDate(1); // First day of the quarter
        nextRun.setHours(9, 0, 0, 0); // 9 AM
        break;
    }

    return nextRun;
  }

  /**
   * Get appropriate date range for frequency
   */
  private getDateRangeForFrequency(frequency: ScheduleFrequency): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();

    switch (frequency) {
      case 'daily':
        start.setDate(start.getDate() - 1);
        break;
      case 'weekly':
        start.setDate(start.getDate() - 7);
        break;
      case 'monthly':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarterly':
        start.setMonth(start.getMonth() - 3);
        break;
    }

    return { start, end };
  }

  /**
   * Log report execution error
   */
  private async logReportError(reportId: string, error: string): Promise<void> {
    // Could be expanded to log to a dedicated error table
    console.error(`Scheduled report error - Report ID: ${reportId}, Error: ${error}`);
    
    // Update the report to indicate last error
    await db.scheduledReport.update({
      where: { id: reportId },
      data: {
        // Could add a lastError field to track this
        updatedAt: new Date(),
      },
    });
  }
}

// Utility functions for scheduled reports
export async function processScheduledReports(): Promise<void> {
  const manager = new ScheduledReportsManager();
  const dueReports = await manager.getDueReports();
  
  console.log(`Processing ${dueReports.length} due reports`);
  
  for (const report of dueReports) {
    if (report.id) {
      await manager.executeScheduledReport(report.id);
    }
  }
}

export function validateScheduledReportConfig(config: Partial<ScheduledReportConfig>): string[] {
  const errors: string[] = [];
  
  if (!config.name?.trim()) {
    errors.push('Report name is required');
  }
  
  if (!config.frequency) {
    errors.push('Frequency is required');
  }
  
  if (!config.format) {
    errors.push('Export format is required');
  }
  
  if (!config.dataType) {
    errors.push('Data type is required');
  }
  
  if (!config.emailRecipients || config.emailRecipients.length === 0) {
    errors.push('At least one email recipient is required');
  }
  
  if (config.emailRecipients) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of config.emailRecipients) {
      if (!emailRegex.test(email)) {
        errors.push(`Invalid email address: ${email}`);
      }
    }
  }
  
  return errors;
}