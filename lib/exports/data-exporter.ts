import { parse } from 'json2csv';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { getUserAnalytics, getApplicationStatusHistory, type AnalyticsData } from '@/lib/analytics';
import { getJobSearchEffectiveness } from '@/lib/analytics/job-search-effectiveness';
import { getCurrentUser } from '@/lib/user/query';
import { db } from '@/lib/db/client';

export type ExportFormat = 'csv' | 'excel' | 'json' | 'pdf';
export type DataType = 'applications' | 'job-searches' | 'resumes' | 'interviews' | 'combined';

export interface ExportOptions {
  format: ExportFormat;
  dataType: DataType;
  dateRange?: {
    start: Date;
    end: Date;
  };
  includeCharts?: boolean;
  includeSummary?: boolean;
  includeDetails?: boolean;
  customFields?: string[];
  filters?: Record<string, any>;
}

export interface ExportableData {
  applications: any[];
  jobSearches: any[];
  resumes: any[];
  interviews: any[];
  analytics: AnalyticsData;
  metadata: {
    exportDate: Date;
    userId: string;
    dateRange: { start: Date; end: Date };
    recordCount: number;
  };
}

export class DataExporter {
  /**
   * Export user data in the specified format
   */
  async exportData(options: ExportOptions): Promise<Buffer> {
    const data = await this.gatherData(options);
    
    switch (options.format) {
      case 'csv':
        return this.exportToCSV(data, options);
      case 'excel':
        return this.exportToExcel(data, options);
      case 'json':
        return this.exportToJSON(data, options);
      case 'pdf':
        return this.exportToPDF(data, options);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Gather all data for export based on options
   */
  private async gatherData(options: ExportOptions): Promise<ExportableData> {
    const user = await getCurrentUser();
    const dateRange = options.dateRange || {
      start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
      end: new Date()
    };

    // Get analytics data
    const analytics = await getUserAnalytics({
      days: Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)),
      startDate: dateRange.start,
      endDate: dateRange.end
    });

    // Get detailed data based on data type
    const applications = await this.getApplicationsData(user.id, dateRange, options.filters);
    const jobSearches = await this.getJobSearchesData(user.id, dateRange, options.filters);
    const resumes = await this.getResumesData(user.id, dateRange, options.filters);
    const interviews = await this.getInterviewsData(user.id, dateRange, options.filters);

    return {
      applications,
      jobSearches,
      resumes,
      interviews,
      analytics,
      metadata: {
        exportDate: new Date(),
        userId: user.id,
        dateRange,
        recordCount: applications.length + jobSearches.length + resumes.length + interviews.length
      }
    };
  }

  /**
   * Get applications data with full details
   */
  private async getApplicationsData(userId: string, dateRange: { start: Date; end: Date }, filters?: Record<string, any>) {
    const whereClause: any = {
      userId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end
      }
    };

    // Apply filters
    if (filters?.status) {
      whereClause.status = filters.status;
    }
    if (filters?.jobProvider) {
      whereClause.jobLead = {
        jobListing: {
          jobProvider: filters.jobProvider
        }
      };
    }

    return db.applicationSubmission.findMany({
      where: whereClause,
      include: {
        jobLead: {
          include: {
            jobListing: {
              include: {
                company: true
              }
            }
          }
        },
        resume: true,
        coverLetter: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Get job searches data
   */
  private async getJobSearchesData(userId: string, dateRange: { start: Date; end: Date }, filters?: Record<string, any>) {
    const whereClause: any = {
      userId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end
      }
    };

    if (filters?.status) {
      whereClause.status = filters.status;
    }

    return db.jobSearch.findMany({
      where: whereClause,
      include: {
        jobSearchListings: {
          include: {
            jobListing: {
              include: {
                jobLeads: {
                  include: {
                    applicationSubmissions: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Get resumes data with performance metrics
   */
  private async getResumesData(userId: string, dateRange: { start: Date; end: Date }, filters?: Record<string, any>) {
    const whereClause: any = {
      userId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end
      }
    };

    return db.resume.findMany({
      where: whereClause,
      include: {
        revisions: {
          include: {
            analysis: true
          }
        },
        applicationSubmissions: {
          where: {
            createdAt: {
              gte: dateRange.start,
              lte: dateRange.end
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Get interviews data
   */
  private async getInterviewsData(userId: string, dateRange: { start: Date; end: Date }, filters?: Record<string, any>) {
    // For now, return interview data from application submissions
    // This could be expanded if we add a dedicated interviews table
    const applications = await db.applicationSubmission.findMany({
      where: {
        userId,
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end
        },
        OR: [
          { status: 'INTERVIEWING' },
          { status: 'OFFERED' },
          { status: 'ACCEPTED' }
        ]
      },
      include: {
        jobLead: {
          include: {
            jobListing: {
              include: {
                company: true
              }
            }
          }
        }
      },
      orderBy: {
        firstInterviewDate: 'desc'
      }
    });

    return applications.filter(app => app.firstInterviewDate);
  }

  /**
   * Export to CSV format
   */
  private async exportToCSV(data: ExportableData, options: ExportOptions): Promise<Buffer> {
    let csvData: any[] = [];

    switch (options.dataType) {
      case 'applications':
        csvData = data.applications.map(app => ({
          id: app.id,
          jobTitle: app.jobLead?.jobListing?.title || 'N/A',
          company: app.jobLead?.jobListing?.company?.name || 'N/A',
          jobProvider: app.jobLead?.jobListing?.jobProvider || 'N/A',
          status: app.status,
          appliedDate: format(app.createdAt, 'yyyy-MM-dd HH:mm'),
          resumeName: app.resume?.name || 'N/A',
          firstResponseDate: app.firstResponseDate ? format(app.firstResponseDate, 'yyyy-MM-dd') : 'N/A',
          firstInterviewDate: app.firstInterviewDate ? format(app.firstInterviewDate, 'yyyy-MM-dd') : 'N/A',
          offerDate: app.offerDate ? format(app.offerDate, 'yyyy-MM-dd') : 'N/A',
          salary: app.salary || 'N/A',
          location: app.jobLead?.jobListing?.location || 'N/A',
          notes: app.notes || ''
        }));
        break;
      
      case 'job-searches':
        csvData = data.jobSearches.map(search => ({
          id: search.id,
          query: search.query,
          location: search.location,
          status: search.status,
          createdDate: format(search.createdAt, 'yyyy-MM-dd HH:mm'),
          resultsCount: search.jobSearchListings?.length || 0,
          applicationsCount: search.jobSearchListings?.reduce(
            (acc: number, link: any) =>
              acc +
                (link.jobListing?.jobLeads?.reduce(
                  (leadAcc: number, lead: any) =>
                    leadAcc + (lead.applicationSubmissions?.length || 0),
                  0,
                ) || 0),
            0,
          ) || 0
        }));
        break;

      case 'resumes':
        csvData = data.resumes.map(resume => ({
          id: resume.id,
          name: resume.name,
          createdDate: format(resume.createdAt, 'yyyy-MM-dd'),
          revisionsCount: resume.revisions?.length || 0,
          applicationsCount: resume.applicationSubmissions?.length || 0,
          latestScore: resume.revisions?.[0]?.analysis?.overallScore || 'N/A',
          isActive: resume.isActive
        }));
        break;

      case 'interviews':
        csvData = data.interviews.map(interview => ({
          applicationId: interview.id,
          jobTitle: interview.jobLead?.jobListing?.title || 'N/A',
          company: interview.jobLead?.jobListing?.company?.name || 'N/A',
          interviewDate: interview.firstInterviewDate ? format(interview.firstInterviewDate, 'yyyy-MM-dd') : 'N/A',
          status: interview.status,
          offerDate: interview.offerDate ? format(interview.offerDate, 'yyyy-MM-dd') : 'N/A',
          salary: interview.salary || 'N/A'
        }));
        break;

      case 'combined':
        // Include summary data from analytics
        csvData.push({
          section: 'Summary',
          metric: 'Total Applications',
          value: data.analytics.overview.total
        });
        csvData.push({
          section: 'Summary',
          metric: 'Response Rate',
          value: `${data.analytics.responseRates.responseRate.toFixed(2)}%`
        });
        csvData.push({
          section: 'Summary',
          metric: 'Interview Rate',
          value: `${data.analytics.responseRates.interviewRate.toFixed(2)}%`
        });
        break;
    }

    if (options.customFields && csvData.length > 0) {
      csvData = csvData.map(row => {
        const filteredRow: any = {};
        options.customFields!.forEach(field => {
          if (row[field] !== undefined) {
            filteredRow[field] = row[field];
          }
        });
        return filteredRow;
      });
    }

    const csv = parse(csvData);
    return Buffer.from(csv);
  }

  /**
   * Export to Excel format with multiple sheets
   */
  private async exportToExcel(data: ExportableData, options: ExportOptions): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    // Metadata
    workbook.creator = 'Gimme Job';
    workbook.lastModifiedBy = 'Data Exporter';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Summary Sheet
    if (options.includeSummary !== false) {
      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.columns = [
        { header: 'Metric', key: 'metric', width: 30 },
        { header: 'Value', key: 'value', width: 20 }
      ];

      summarySheet.addRows([
        { metric: 'Export Date', value: format(data.metadata.exportDate, 'yyyy-MM-dd HH:mm') },
        { metric: 'Date Range', value: `${format(data.metadata.dateRange.start, 'yyyy-MM-dd')} to ${format(data.metadata.dateRange.end, 'yyyy-MM-dd')}` },
        { metric: 'Total Records', value: data.metadata.recordCount },
        { metric: 'Total Applications', value: data.analytics.overview.total },
        { metric: 'Response Rate', value: `${data.analytics.responseRates.responseRate.toFixed(2)}%` },
        { metric: 'Interview Rate', value: `${data.analytics.responseRates.interviewRate.toFixed(2)}%` },
        { metric: 'Offer Rate', value: `${data.analytics.responseRates.offerRate.toFixed(2)}%` }
      ]);

      this.styleWorksheetHeaders(summarySheet);
    }

    // Applications Sheet
    if (options.dataType === 'applications' || options.dataType === 'combined') {
      const appsSheet = workbook.addWorksheet('Applications');
      appsSheet.columns = [
        { header: 'Job Title', key: 'jobTitle', width: 30 },
        { header: 'Company', key: 'company', width: 25 },
        { header: 'Job Board', key: 'jobProvider', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Applied Date', key: 'appliedDate', width: 20 },
        { header: 'Resume', key: 'resumeName', width: 25 },
        { header: 'First Response', key: 'firstResponseDate', width: 15 },
        { header: 'Interview Date', key: 'firstInterviewDate', width: 15 },
        { header: 'Offer Date', key: 'offerDate', width: 15 },
        { header: 'Salary', key: 'salary', width: 15 },
        { header: 'Location', key: 'location', width: 20 }
      ];

      data.applications.forEach(app => {
        appsSheet.addRow({
          jobTitle: app.jobLead?.jobListing?.title || 'N/A',
          company: app.jobLead?.jobListing?.company?.name || 'N/A',
          jobProvider: app.jobLead?.jobListing?.jobProvider || 'N/A',
          status: app.status,
          appliedDate: format(app.createdAt, 'yyyy-MM-dd HH:mm'),
          resumeName: app.resume?.name || 'N/A',
          firstResponseDate: app.firstResponseDate ? format(app.firstResponseDate, 'yyyy-MM-dd') : 'N/A',
          firstInterviewDate: app.firstInterviewDate ? format(app.firstInterviewDate, 'yyyy-MM-dd') : 'N/A',
          offerDate: app.offerDate ? format(app.offerDate, 'yyyy-MM-dd') : 'N/A',
          salary: app.salary || 'N/A',
          location: app.jobLead?.jobListing?.location || 'N/A'
        });
      });

      this.styleWorksheetHeaders(appsSheet);
    }

    // Job Searches Sheet
    if (options.dataType === 'job-searches' || options.dataType === 'combined') {
      const searchesSheet = workbook.addWorksheet('Job Searches');
      searchesSheet.columns = [
        { header: 'Query', key: 'query', width: 30 },
        { header: 'Location', key: 'location', width: 20 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Created Date', key: 'createdDate', width: 20 },
        { header: 'Results Count', key: 'resultsCount', width: 15 },
        { header: 'Applications', key: 'applicationsCount', width: 15 }
      ];

      data.jobSearches.forEach(search => {
        searchesSheet.addRow({
          query: search.query,
          location: search.location,
          status: search.status,
          createdDate: format(search.createdAt, 'yyyy-MM-dd HH:mm'),
          resultsCount: search.jobSearchListings?.length || 0,
          applicationsCount: search.jobSearchListings?.reduce(
            (acc: number, link: any) =>
              acc +
                (link.jobListing?.jobLeads?.reduce(
                  (leadAcc: number, lead: any) =>
                    leadAcc + (lead.applicationSubmissions?.length || 0),
                  0,
                ) || 0),
            0,
          ) || 0
        });
      });

      this.styleWorksheetHeaders(searchesSheet);
    }

    // Resumes Sheet
    if (options.dataType === 'resumes' || options.dataType === 'combined') {
      const resumesSheet = workbook.addWorksheet('Resumes');
      resumesSheet.columns = [
        { header: 'Name', key: 'name', width: 30 },
        { header: 'Created Date', key: 'createdDate', width: 20 },
        { header: 'Revisions', key: 'revisionsCount', width: 15 },
        { header: 'Applications', key: 'applicationsCount', width: 15 },
        { header: 'Latest Score', key: 'latestScore', width: 15 },
        { header: 'Active', key: 'isActive', width: 10 }
      ];

      data.resumes.forEach(resume => {
        resumesSheet.addRow({
          name: resume.name,
          createdDate: format(resume.createdAt, 'yyyy-MM-dd'),
          revisionsCount: resume.revisions?.length || 0,
          applicationsCount: resume.applicationSubmissions?.length || 0,
          latestScore: resume.revisions?.[0]?.analysis?.overallScore || 'N/A',
          isActive: resume.isActive ? 'Yes' : 'No'
        });
      });

      this.styleWorksheetHeaders(resumesSheet);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Export to JSON format
   */
  private async exportToJSON(data: ExportableData, options: ExportOptions): Promise<Buffer> {
    const exportData: any = {
      metadata: data.metadata,
      analytics: {
        overview: data.analytics.overview,
        responseRates: data.analytics.responseRates,
        timeToResponse: data.analytics.timeToResponse,
        jobProviderPerformance: data.analytics.jobProviderPerformance,
        resumePerformance: data.analytics.resumePerformance
      }
    };

    // Include detailed data based on type
    switch (options.dataType) {
      case 'applications':
        exportData.applications = data.applications;
        break;
      case 'job-searches':
        exportData.jobSearches = data.jobSearches;
        break;
      case 'resumes':
        exportData.resumes = data.resumes;
        break;
      case 'interviews':
        exportData.interviews = data.interviews;
        break;
      case 'combined':
        exportData.applications = data.applications;
        exportData.jobSearches = data.jobSearches;
        exportData.resumes = data.resumes;
        exportData.interviews = data.interviews;
        break;
    }

    return Buffer.from(JSON.stringify(exportData, null, 2));
  }

  /**
   * Export to PDF format
   */
  private async exportToPDF(data: ExportableData, options: ExportOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title Page
      doc.fontSize(24).text('Job Search Data Export', { align: 'center' });
      doc.fontSize(12).text(`Generated: ${format(data.metadata.exportDate, 'MMMM dd, yyyy HH:mm')}`, { align: 'center' });
      doc.fontSize(10).text(`Date Range: ${format(data.metadata.dateRange.start, 'MMM dd, yyyy')} - ${format(data.metadata.dateRange.end, 'MMM dd, yyyy')}`, { align: 'center' });
      doc.moveDown(2);

      // Executive Summary
      doc.fontSize(18).text('Executive Summary', { underline: true });
      doc.fontSize(12);
      doc.text(`Total Applications: ${data.analytics.overview.total}`);
      doc.text(`Response Rate: ${data.analytics.responseRates.responseRate.toFixed(2)}%`);
      doc.text(`Interview Rate: ${data.analytics.responseRates.interviewRate.toFixed(2)}%`);
      doc.text(`Offer Rate: ${data.analytics.responseRates.offerRate.toFixed(2)}%`);
      doc.moveDown();

      // Status Breakdown
      doc.fontSize(16).text('Application Status Breakdown', { underline: true });
      doc.fontSize(12);
      doc.text(`Submitted: ${data.analytics.overview.submitted}`);
      doc.text(`Rejected: ${data.analytics.overview.rejected}`);
      doc.text(`Interviewing: ${data.analytics.overview.interviewing}`);
      doc.text(`Offered: ${data.analytics.overview.offered}`);
      doc.text(`Accepted: ${data.analytics.overview.accepted}`);
      doc.moveDown();

      // Job Board Performance
      if (data.analytics.jobProviderPerformance.length > 0) {
        doc.addPage();
        doc.fontSize(18).text('Job Board Performance', { underline: true });
        doc.fontSize(12);
        
        data.analytics.jobProviderPerformance.forEach(board => {
          doc.text(`${board.jobProvider}:`);
          doc.text(`  • Applications: ${board.applications}`);
          doc.text(`  • Response Rate: ${board.responseRate.toFixed(2)}%`);
          doc.text(`  • Interview Rate: ${board.interviewRate.toFixed(2)}%`);
          doc.text(`  • Offer Rate: ${board.offerRate.toFixed(2)}%`);
          doc.moveDown(0.5);
        });
      }

      // Resume Performance
      if (data.analytics.resumePerformance.length > 0) {
        doc.addPage();
        doc.fontSize(18).text('Resume Performance', { underline: true });
        doc.fontSize(12);
        
        data.analytics.resumePerformance.forEach(resume => {
          doc.text(`${resume.resumeName}:`);
          doc.text(`  • Applications: ${resume.applications}`);
          doc.text(`  • Response Rate: ${resume.responseRate.toFixed(2)}%`);
          doc.text(`  • Interview Rate: ${resume.interviewRate.toFixed(2)}%`);
          doc.text(`  • Offer Rate: ${resume.offerRate.toFixed(2)}%`);
          doc.moveDown(0.5);
        });
      }

      doc.end();
    });
  }

  /**
   * Style worksheet headers with formatting
   */
  private styleWorksheetHeaders(worksheet: ExcelJS.Worksheet) {
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    worksheet.getRow(1).border = {
      bottom: { style: 'thin' }
    };
  }
}

// Export utility functions
export async function exportUserData(options: ExportOptions): Promise<Buffer> {
  const exporter = new DataExporter();
  return exporter.exportData(options);
}

export function getContentType(format: ExportFormat): string {
  switch (format) {
    case 'csv':
      return 'text/csv';
    case 'excel':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'json':
      return 'application/json';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

export function getFileName(format: ExportFormat, dataType: DataType, dateRange?: { start: Date; end: Date }): string {
  const timestamp = format(new Date(), 'yyyy-MM-dd');
  const extension = format === 'excel' ? 'xlsx' : format;
  const rangeStr = dateRange ? 
    `${format(dateRange.start, 'yyyy-MM-dd')}_to_${format(dateRange.end, 'yyyy-MM-dd')}` : 
    'current';
  
  return `job-search-${dataType}-${rangeStr}-${timestamp}.${extension}`;
}
