import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function TablePage() {
  const users = [
    { id: '1', name: 'John Doe', email: 'john@example.com', role: 'Developer', status: 'active' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'Designer', status: 'active' },
    { id: '3', name: 'Bob Wilson', email: 'bob@example.com', role: 'Manager', status: 'inactive' },
  ];

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Table</h1>
        <p className="text-muted-foreground mb-6">
          Basic table components for displaying tabular data
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basic Table</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="preview">
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="code">Code</TabsTrigger>
            </TabsList>
            <TabsContent value="preview">
              <div className="border rounded-lg mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map(user => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.role}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              user.status === 'active'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }
                          >
                            {user.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="code">
              <div className="bg-muted p-4 rounded-lg mt-4">
                <pre className="text-sm overflow-x-auto">
{`import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Email</TableHead>
      <TableHead>Role</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>John Doe</TableCell>
      <TableCell>john@example.com</TableCell>
      <TableCell>Developer</TableCell>
    </TableRow>
  </TableBody>
</Table>`}
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Components</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="p-3 bg-muted rounded">
              <code className="font-mono text-sm">Table</code> - Root table wrapper
            </div>
            <div className="p-3 bg-muted rounded">
              <code className="font-mono text-sm">TableHeader</code> - Table header section
            </div>
            <div className="p-3 bg-muted rounded">
              <code className="font-mono text-sm">TableBody</code> - Table body section
            </div>
            <div className="p-3 bg-muted rounded">
              <code className="font-mono text-sm">TableRow</code> - Table row
            </div>
            <div className="p-3 bg-muted rounded">
              <code className="font-mono text-sm">TableHead</code> - Table header cell
            </div>
            <div className="p-3 bg-muted rounded">
              <code className="font-mono text-sm">TableCell</code> - Table data cell
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
