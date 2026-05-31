import { QuickExport } from '@/components/exports/quick-export';
import { ReportBuilder } from '@/components/exports/report-builder';
import { ScheduledReportsManager } from '@/components/exports/scheduled-reports-manager';
import { ShareableDashboardManager } from '@/components/exports/shareable-dashboard-manager';
import { Page, PageContent, PageHeader } from '@/components/layout/page';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Download, Settings, Share2 } from 'lucide-react';

export default function ExportsPage() {
  return (
    <Page name="analytics-exports" title="Data Export & Reporting">
      <PageHeader
        title="Data Export & Reporting"
        description="Export your job search data, create custom reports, and share analytics dashboards"
      />
      <PageContent>
        <Tabs defaultValue="quick" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="quick" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Quick Export
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Custom Reports
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Scheduled Reports
            </TabsTrigger>
            <TabsTrigger value="sharing" className="flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Shareable Dashboards
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <QuickExport />

              <Card>
                <CardHeader>
                  <CardTitle>Export Formats Available</CardTitle>
                  <CardDescription>
                    Choose the format that best suits your needs
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
                        <span className="text-xs font-bold text-green-700">
                          CSV
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium">
                          CSV (Comma-Separated Values)
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Perfect for spreadsheet applications like Excel or
                          Google Sheets. Raw data format.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                        <span className="text-xs font-bold text-blue-700">
                          XLS
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium">Excel Workbook</h4>
                        <p className="text-sm text-muted-foreground">
                          Rich formatted spreadsheet with multiple sheets,
                          charts, and styling.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                        <span className="text-xs font-bold text-purple-700">
                          PDF
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium">PDF Report</h4>
                        <p className="text-sm text-muted-foreground">
                          Professional report format with charts, graphs, and
                          formatted layouts.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
                        <span className="text-xs font-bold text-orange-700">
                          JSON
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium">JSON Data</h4>
                        <p className="text-sm text-muted-foreground">
                          Structured data format ideal for API integrations and
                          custom applications.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="custom" className="space-y-6">
            <ReportBuilder />
          </TabsContent>

          <TabsContent value="scheduled" className="space-y-6">
            <ScheduledReportsManager />

            <Card>
              <CardHeader>
                <CardTitle>How Scheduled Reports Work</CardTitle>
                <CardDescription>
                  Automatically generate and email reports on your schedule
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <h4 className="font-medium">Frequency Options</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>
                        • <strong>Daily:</strong> Every day at 9 AM
                      </li>
                      <li>
                        • <strong>Weekly:</strong> Same day each week at 9 AM
                      </li>
                      <li>
                        • <strong>Monthly:</strong> First day of each month at 9
                        AM
                      </li>
                      <li>
                        • <strong>Quarterly:</strong> First day of each quarter
                        at 9 AM
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium">Email Delivery</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Send to multiple recipients</li>
                      <li>• Professional email formatting</li>
                      <li>• Report attached as file</li>
                      <li>• Delivery confirmation tracking</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sharing" className="space-y-6">
            <ShareableDashboardManager />

            <Card>
              <CardHeader>
                <CardTitle>Sharing Best Practices</CardTitle>
                <CardDescription>
                  Keep your shared dashboards secure and professional
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <h4 className="font-medium">Security Features</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Password protection for sensitive data</li>
                      <li>• Domain restrictions for internal sharing</li>
                      <li>• Expiration dates for temporary access</li>
                      <li>• Access tracking and analytics</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium">Use Cases</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Share progress with career counselors</li>
                      <li>• Collaborate with mentors</li>
                      <li>• Present to potential employers</li>
                      <li>• Track team job search efforts</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </PageContent>
    </Page>
  );
}
