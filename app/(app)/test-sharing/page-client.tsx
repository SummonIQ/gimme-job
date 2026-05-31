'use client';

import { useState } from 'react';
import { ShareableResourceType } from '@/lib/sharing/types';
import { ShareResourceDialog } from '@/components/sharing/share-resource-dialog';
import { ShareLinksManager } from '@/components/sharing/share-links-manager';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export default function TestSharingPage() {
  const [resourceType, setResourceType] = useState<ShareableResourceType>(ShareableResourceType.RESUME);
  const [resourceId, setResourceId] = useState('test-resource-id');
  const [resourceName, setResourceName] = useState('Test Resource');
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  
  // For demonstration purposes - normally these would come from your database
  const sampleResources = {
    [ShareableResourceType.RESUME]: [
      { id: 'resume-1', name: 'Software Engineer Resume' },
      { id: 'resume-2', name: 'Product Manager Resume' }
    ],
    [ShareableResourceType.JOB_LEAD]: [
      { id: 'job-lead-1', name: 'Senior Developer at Tech Co' },
      { id: 'job-lead-2', name: 'UX Designer at Design Studio' }
    ]
  };
  
  const handleResourceTypeChange = (type: ShareableResourceType) => {
    setResourceType(type);
    // Set default resource for the selected type
    if (sampleResources[type].length > 0) {
      setResourceId(sampleResources[type][0].id);
      setResourceName(sampleResources[type][0].name);
    }
  };
  
  const handleResourceChange = (id: string) => {
    setResourceId(id);
    const resource = sampleResources[resourceType].find(r => r.id === id);
    if (resource) {
      setResourceName(resource.name);
    }
  };
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Sharing Functionality Test Page</h1>
      
      <div className="grid gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Configure Test Resource</CardTitle>
            <CardDescription>Select a resource type and ID to test sharing functionality</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Resource Type</label>
                <Select
                  value={resourceType}
                  onValueChange={(value) => handleResourceTypeChange(value as ShareableResourceType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select resource type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ShareableResourceType.RESUME}>Resume</SelectItem>
                    <SelectItem value={ShareableResourceType.JOB_LEAD}>Job Lead</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Resource</label>
                <Select
                  value={resourceId}
                  onValueChange={handleResourceChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select resource" />
                  </SelectTrigger>
                  <SelectContent>
                    {sampleResources[resourceType].map(resource => (
                      <SelectItem key={resource.id} value={resource.id}>
                        {resource.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Resource Name (editable)</label>
                <Input
                  value={resourceName}
                  onChange={(e) => setResourceName(e.target.value)}
                  placeholder="Enter resource name"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={() => setShareDialogOpen(true)}>
              Create Share Link
            </Button>
          </CardFooter>
        </Card>
        
        <ShareLinksManager
          resourceId={resourceId}
          resourceType={resourceType}
          resourceName={resourceName}
        />
      </div>
      
      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md mb-8">
        <h3 className="font-medium text-yellow-800 mb-2">Testing Notes</h3>
        <p className="text-sm text-yellow-700">
          This is a test page for the sharing functionality. In a real application, you would integrate 
          the <code>ShareLinksManager</code> component on your Resume and Job Lead detail pages. 
          The <code>ShareResourceDialog</code> component can be triggered from a share button.
        </p>
        <p className="text-sm text-yellow-700 mt-2">
          To view a shared resource, you would access <code>/shared/[token]</code> where token is the generated share token.
        </p>
      </div>
      
      <ShareResourceDialog
        isOpen={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        resourceId={resourceId}
        resourceType={resourceType}
        resourceName={resourceName}
      />
    </div>
  );
}
