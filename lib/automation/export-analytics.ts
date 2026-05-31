import { parse } from 'json2csv';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import type { EnhancedAutomationMetrics } from './analytics-enhanced';

export type ExportFormat = 'csv' | 'excel' | 'json' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  dateRange: 'day' | 'week' | 'month';
  includeCharts?: boolean;
  includeSummary?: boolean;
  includeDetails?: boolean;
  customFields?: string[];
}

export class AnalyticsExporter {
  /**
   * Export analytics data in the specified format
   */
  async exportAnalytics(
    metrics: EnhancedAutomationMetrics,
    options: ExportOptions
  ): Promise<Buffer> {
    switch (options.format) {
      case 'csv':
        return this.exportToCSV(metrics, options);
      case 'excel':
        return this.exportToExcel(metrics, options);
      case 'json':
        return this.exportToJSON(metrics, options);
      case 'pdf':
        return this.exportToPDF(metrics, options);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Export to CSV format
   */
  private async exportToCSV(
    metrics: EnhancedAutomationMetrics,
    options: ExportOptions
  ): Promise<Buffer> {
    const data: any[] = [];

    // Summary section
    if (options.includeSummary !== false) {
      data.push({
        section: 'Summary',
        metric: 'Total Automated',
        value: metrics.totalAutomated,
      });
      data.push({
        section: 'Summary',
        metric: 'Total Manual',
        value: metrics.totalManual,
      });
      data.push({
        section: 'Summary',
        metric: 'Success Rate',
        value: `${metrics.successRate.toFixed(2)}%`,
      });
      data.push({
        section: 'Summary',
        metric: 'Time Saved (hours)',
        value: metrics.roiMetrics.totalTimeSaved.toFixed(2),
      });
      data.push({
        section: 'Summary',
        metric: 'Dollar Value Saved',
        value: `$${metrics.roiMetrics.dollarValueSaved.toFixed(2)}`,
      });
    }

    // Platform breakdown
    if (options.includeDetails !== false) {
      metrics.platformBreakdown.forEach(platform => {
        data.push({
          section: 'Platform Performance',
          metric: platform.platform,
          value: platform.totalSubmissions,
          successRate: `${platform.successRate.toFixed(2)}%`,
          averageTime: `${platform.averageTime.toFixed(2)} min`,
          responseRate: `${platform.responseRate.toFixed(2)}%`,
        });
      });
    }

    // Recent activity
    metrics.recentActivity.forEach(activity => {
      data.push({
        section: 'Recent Activity',
        jobTitle: activity.jobTitle,
        company: activity.companyName,
        platform: activity.platform,
        status: activity.status,
        submittedAt: activity.submittedAt ? format(activity.submittedAt, 'yyyy-MM-dd HH:mm') : 'N/A',
        processingTime: activity.processingTime ? `${activity.processingTime} min` : 'N/A',
      });
    });

    const csv = parse(data);
    return Buffer.from(csv);
  }

  /**
   * Export to Excel format with multiple sheets
   */
  private async exportToExcel(
    metrics: EnhancedAutomationMetrics,
    options: ExportOptions
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    
    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
    ];

    summarySheet.addRows([
      { metric: 'Total Automated Applications', value: metrics.totalAutomated },
      { metric: 'Total Manual Applications', value: metrics.totalManual },
      { metric: 'Success Rate', value: `${metrics.successRate.toFixed(2)}%` },
      { metric: 'Failure Rate', value: `${metrics.failureRate.toFixed(2)}%` },
      { metric: 'Average Processing Time', value: `${metrics.averageProcessingTime.toFixed(2)} min` },
      { metric: 'Time Saved', value: `${metrics.roiMetrics.totalTimeSaved.toFixed(2)} hours` },
      { metric: 'Dollar Value Saved', value: `$${metrics.roiMetrics.dollarValueSaved.toFixed(2)}` },
      { metric: 'Efficiency Gain', value: `${metrics.roiMetrics.efficiencyGain.toFixed(2)}%` },
    ]);

    // Platform Performance Sheet
    const platformSheet = workbook.addWorksheet('Platform Performance');
    platformSheet.columns = [
      { header: 'Platform', key: 'platform', width: 20 },
      { header: 'Total Submissions', key: 'total', width: 18 },
      { header: 'Success Count', key: 'success', width: 15 },
      { header: 'Success Rate', key: 'successRate', width: 15 },
      { header: 'Avg Time (min)', key: 'avgTime', width: 15 },
      { header: 'Response Rate', key: 'responseRate', width: 15 },
      { header: 'Interview Rate', key: 'interviewRate', width: 15 },
    ];

    metrics.platformBreakdown.forEach(platform => {
      platformSheet.addRow({
        platform: platform.platform,
        total: platform.totalSubmissions,
        success: platform.successCount,
        successRate: `${platform.successRate.toFixed(2)}%`,
        avgTime: platform.averageTime.toFixed(2),
        responseRate: `${platform.responseRate.toFixed(2)}%`,
        interviewRate: `${platform.interviewRate.toFixed(2)}%`,
      });
    });

    // Timing Analysis Sheet
    const timingSheet = workbook.addWorksheet('Timing Analysis');
    timingSheet.columns = [
      { header: 'Time Period', key: 'period', width: 20 },
      { header: 'Submissions', key: 'submissions', width: 15 },
      { header: 'Success Rate', key: 'successRate', width: 15 },
    ];

    metrics.timeBreakdown.forEach(time => {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      timingSheet.addRow({
        period: `${dayNames[time.dayOfWeek]} ${time.hour}:00`,
        submissions: time.submissions,
        successRate: `${time.successRate.toFixed(2)}%`,
      });
    });

    // Recent Activity Sheet
    const activitySheet = workbook.addWorksheet('Recent Activity');
    activitySheet.columns = [
      { header: 'Job Title', key: 'jobTitle', width: 30 },
      { header: 'Company', key: 'company', width: 25 },
      { header: 'Platform', key: 'platform', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Submitted At', key: 'submittedAt', width: 20 },
      { header: 'Processing Time', key: 'processingTime', width: 15 },
    ];

    metrics.recentActivity.forEach(activity => {
      activitySheet.addRow({
        jobTitle: activity.jobTitle,
        company: activity.companyName,
        platform: activity.platform,
        status: activity.status,
        submittedAt: activity.submittedAt ? format(activity.submittedAt, 'yyyy-MM-dd HH:mm') : 'N/A',
        processingTime: activity.processingTime ? `${activity.processingTime} min` : 'N/A',
      });
    });

    // Style the headers
    [summarySheet, platformSheet, timingSheet, activitySheet].forEach(sheet => {
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Export to JSON format
   */
  private async exportToJSON(
    metrics: EnhancedAutomationMetrics,
    options: ExportOptions
  ): Promise<Buffer> {
    const exportData: any = {
      exportDate: new Date().toISOString(),
      dateRange: options.dateRange,
      summary: {
        totalAutomated: metrics.totalAutomated,
        totalManual: metrics.totalManual,
        successRate: metrics.successRate,
        failureRate: metrics.failureRate,
        averageProcessingTime: metrics.averageProcessingTime,
      },
      roi: metrics.roiMetrics,
      platforms: metrics.platformBreakdown,
      performance: metrics.performanceMetrics,
      successFactors: metrics.successFactors,
    };

    if (options.includeDetails) {
      exportData.timingAnalysis = metrics.timingEffectiveness;
      exportData.optimalTiming = metrics.optimalTimingAnalysis;
      exportData.recentActivity = metrics.recentActivity;
      exportData.alerts = metrics.alerts;
      exportData.anomalies = metrics.anomalies;
    }

    return Buffer.from(JSON.stringify(exportData, null, 2));
  }

  /**
   * Export to PDF format with charts and formatting
   */
  private async exportToPDF(
    metrics: EnhancedAutomationMetrics,
    options: ExportOptions
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title Page
      doc.fontSize(24).text('Automation Analytics Report', { align: 'center' });
      doc.fontSize(12).text(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, { align: 'center' });
      doc.moveDown(2);

      // Executive Summary
      doc.fontSize(18).text('Executive Summary', { underline: true });
      doc.fontSize(12);
      doc.text(`Total Automated Applications: ${metrics.totalAutomated}`);
      doc.text(`Success Rate: ${metrics.successRate.toFixed(2)}%`);
      doc.text(`Time Saved: ${metrics.roiMetrics.totalTimeSaved.toFixed(2)} hours`);
      doc.text(`Dollar Value Saved: $${metrics.roiMetrics.dollarValueSaved.toFixed(2)}`);
      doc.text(`Efficiency Gain: ${metrics.roiMetrics.efficiencyGain.toFixed(2)}%`);
      doc.moveDown();

      // Performance Metrics
      doc.fontSize(18).text('Performance Metrics', { underline: true });
      doc.fontSize(12);
      doc.text(`Trend: ${metrics.performanceMetrics.trend}`);
      doc.text(`Performance Score: ${metrics.performanceMetrics.performanceScore}/100`);
      doc.text(`Reliability Score: ${metrics.performanceMetrics.reliabilityScore}/100`);
      doc.text(`Efficiency Score: ${metrics.performanceMetrics.efficiencyScore}/100`);
      doc.moveDown();

      // Platform Breakdown
      doc.addPage();
      doc.fontSize(18).text('Platform Performance', { underline: true });
      doc.fontSize(12);
      
      metrics.platformBreakdown.forEach(platform => {
        doc.text(`${platform.platform}:`);
        doc.text(`  • Submissions: ${platform.totalSubmissions}`);
        doc.text(`  • Success Rate: ${platform.successRate.toFixed(2)}%`);
        doc.text(`  • Average Time: ${platform.averageTime.toFixed(2)} minutes`);
        doc.text(`  • Response Rate: ${platform.responseRate.toFixed(2)}%`);
        doc.moveDown(0.5);
      });

      // Timing Analysis
      if (metrics.timingEffectiveness) {
        doc.addPage();
        doc.fontSize(18).text('Timing Analysis', { underline: true });
        doc.fontSize(12);
        doc.text(`Best Hours: ${metrics.timingEffectiveness.bestHours.join(', ')}`);
        doc.text(`Best Days: ${this.getDayNames(metrics.timingEffectiveness.bestDays).join(', ')}`);
        doc.text(`Current Timezone: ${metrics.timingEffectiveness.timezoneOptimization.currentTimezone}`);
        doc.moveDown();
      }

      // Success Factors
      if (metrics.successFactors) {
        doc.fontSize(18).text('Success Factors', { underline: true });
        doc.fontSize(12);
        
        doc.text('Top Success Factors:');
        metrics.successFactors.topSuccessFactors.forEach(factor => {
          doc.text(`  • ${factor.factor}: ${factor.correlation.toFixed(2)}% correlation`);
          doc.text(`    ${factor.description}`);
        });
        doc.moveDown();

        doc.text('Improvement Opportunities:');
        metrics.successFactors.improvementOpportunities.forEach(opp => {
          doc.text(`  • ${opp.area}:`);
          doc.text(`    Current: ${opp.currentPerformance}%, Potential: ${opp.potential}%`);
          doc.text(`    Effort: ${opp.effort}, Impact: ${opp.impact}`);
        });
      }

      // Alerts and Recommendations
      if (metrics.alerts.length > 0) {
        doc.addPage();
        doc.fontSize(18).text('Alerts & Recommendations', { underline: true });
        doc.fontSize(12);
        
        metrics.alerts.forEach(alert => {
          doc.text(`${alert.type.toUpperCase()}: ${alert.title}`);
          doc.text(`  ${alert.message}`);
          if (alert.suggestedAction) {
            doc.text(`  Action: ${alert.suggestedAction}`);
          }
          doc.moveDown(0.5);
        });
      }

      doc.end();
    });
  }

  /**
   * Helper to get day names
   */
  private getDayNames(days: number[]): string[] {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days.map(d => dayNames[d]);
  }

  /**
   * Generate custom report based on selected fields
   */
  async generateCustomReport(
    metrics: EnhancedAutomationMetrics,
    fields: string[],
    format: ExportFormat
  ): Promise<Buffer> {
    const customData: any = {};
    
    // Extract only requested fields
    fields.forEach(field => {
      const value = this.getNestedValue(metrics, field);
      if (value !== undefined) {
        customData[field] = value;
      }
    });

    // Export in requested format
    const options: ExportOptions = {
      format,
      dateRange: 'week',
      customFields: fields,
    };

    // For custom reports, we'll use JSON as the base and convert
    if (format === 'json') {
      return Buffer.from(JSON.stringify(customData, null, 2));
    } else if (format === 'csv') {
      const flatData = this.flattenObject(customData);
      const csv = parse([flatData]);
      return Buffer.from(csv);
    } else {
      // For Excel and PDF, use the standard export with filtered data
      return this.exportAnalytics(metrics, options);
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Flatten nested object for CSV export
   */
  private flattenObject(obj: any, prefix = ''): any {
    const flattened: any = {};
    
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else {
        flattened[newKey] = value;
      }
    });
    
    return flattened;
  }
}

// Export utility function
export async function exportAnalytics(
  metrics: EnhancedAutomationMetrics,
  format: ExportFormat,
  options?: Partial<ExportOptions>
): Promise<Buffer> {
  const exporter = new AnalyticsExporter();
  const fullOptions: ExportOptions = {
    format,
    dateRange: options?.dateRange || 'week',
    includeCharts: options?.includeCharts ?? true,
    includeSummary: options?.includeSummary ?? true,
    includeDetails: options?.includeDetails ?? true,
    customFields: options?.customFields,
  };
  
  return exporter.exportAnalytics(metrics, fullOptions);
}