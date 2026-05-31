import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ReportPage() {
  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Report</h1>
        <p className="text-muted-foreground mb-6">
          Advanced data table component with TanStack Table integration, sorting, filtering, and pagination
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="usage">
            <TabsList>
              <TabsTrigger value="usage">Usage</TabsTrigger>
              <TabsTrigger value="code">Code</TabsTrigger>
            </TabsList>
            <TabsContent value="usage">
              <div className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  The Report component provides a comprehensive data display system with multiple view modes,
                  sorting, filtering, and interactive features.
                </p>
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Key Features</h4>
                  <ul className="text-sm space-y-1">
                    <li>" TanStack Table integration</li>
                    <li>" Multiple view modes (Table, List, Grid, Board)</li>
                    <li>" Built-in sorting and filtering</li>
                    <li>" Pagination support</li>
                    <li>" Export capabilities</li>
                    <li>" Row selection</li>
                  </ul>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="code">
              <div className="bg-muted p-4 rounded-lg mt-4">
                <pre className="text-sm overflow-x-auto">
{`import { Report } from '@/components/reporting/report';
import { ReportView } from '@/types/reporting';

const columns = [
  {
    id: 'name',
    header: 'Name',
    accessorKey: 'name',
    visible: true,
    cellFn: (item) => <div>{item.name}</div>
  }
];

<Report
  data={data}
  definition={{
    columns,
    view: ReportView.Table,
    sortBy: 'name',
  }}
  onRowClick={(item) => console.log(item)}
/>`}
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Props</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-3">Core Props</h4>
              <div className="space-y-2">
                <div className="p-3 bg-muted rounded">
                  <code className="font-mono text-sm">data: T[]</code> - Array of data items
                </div>
                <div className="p-3 bg-muted rounded">
                  <code className="font-mono text-sm">definition: ReportDefinition</code> - Report configuration
                </div>
                <div className="p-3 bg-muted rounded">
                  <code className="font-mono text-sm">onRowClick?: (item: T) =&gt; void</code> - Row click handler
                </div>
                <div className="p-3 bg-muted rounded">
                  <code className="font-mono text-sm">isLoading?: boolean</code> - Loading state
                </div>
                <div className="p-3 bg-muted rounded">
                  <code className="font-mono text-sm">pagination?: PaginationConfig</code> - Pagination settings
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">View Modes</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-muted rounded">
                  <code className="font-mono text-sm">ReportView.Table</code> - Table layout
                </div>
                <div className="p-3 bg-muted rounded">
                  <code className="font-mono text-sm">ReportView.List</code> - List view
                </div>
                <div className="p-3 bg-muted rounded">
                  <code className="font-mono text-sm">ReportView.Grid</code> - Grid layout
                </div>
                <div className="p-3 bg-muted rounded">
                  <code className="font-mono text-sm">ReportView.Board</code> - Kanban board
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
