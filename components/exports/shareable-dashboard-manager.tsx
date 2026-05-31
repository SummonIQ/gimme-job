'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DatePickerWithRange } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/css/index';
import { format } from 'date-fns';
import {
  Copy,
  Edit,
  ExternalLink,
  Loader2,
  Lock,
  Plus,
  Share2,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { toast } from 'sonner';

interface ShareableLink {
  id: string;
  token: string;
  name: string;
  description?: string;
  url: string;
  dashboardConfig: {
    dataTypes: string[];
    dateRange?: { start: Date; end: Date };
    includeDetails: boolean;
    customFields?: string[];
    filters?: Record<string, any>;
  };
  expiresAt?: Date;
  isActive: boolean;
  allowedDomains?: string[];
  requiresPassword?: boolean;
  accessCount: number;
  lastAccessedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ShareableDashboardManagerProps {
  className?: string;
}

const dataTypeOptions = [
  { value: 'applications', label: 'Job Applications' },
  { value: 'job-searches', label: 'Job Searches' },
  { value: 'resumes', label: 'Resumes' },
  { value: 'interviews', label: 'Interviews' },
  { value: 'combined', label: 'Combined Analytics' },
];

export function ShareableDashboardManager({
  className,
}: ShareableDashboardManagerProps) {
  const [links, setLinks] = useState<ShareableLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingLink, setEditingLink] = useState<ShareableLink | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    dataTypes: ['applications'] as string[],
    dateRange: undefined as DateRange | undefined,
    includeDetails: true,
    expiresAt: undefined as Date | undefined,
    allowedDomains: [] as string[],
    requiresPassword: false,
    password: '',
    isActive: true,
  });

  // Load shareable links
  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    try {
      const response = await fetch('/api/exports/shareable');
      if (response.ok) {
        const data = await response.json();
        setLinks(data.links || []);
      } else {
        toast.error('Failed to load shareable links');
      }
    } catch (error) {
      console.error('Error loading links:', error);
      toast.error('Failed to load shareable links');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      dataTypes: ['applications'],
      dateRange: undefined,
      includeDetails: true,
      expiresAt: undefined,
      allowedDomains: [],
      requiresPassword: false,
      password: '',
      isActive: true,
    });
    setEditingLink(null);
  };

  const handleCreateLink = async () => {
    if (!formData.name.trim()) {
      toast.error('Dashboard name is required');
      return;
    }

    if (formData.dataTypes.length === 0) {
      toast.error('At least one data type is required');
      return;
    }

    if (formData.requiresPassword && !formData.password.trim()) {
      toast.error('Password is required when password protection is enabled');
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch('/api/exports/shareable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          dateRange: formData.dateRange
            ? {
                start: formData.dateRange.from?.toISOString(),
                end: formData.dateRange.to?.toISOString(),
              }
            : undefined,
          expiresAt: formData.expiresAt?.toISOString(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Shareable dashboard created successfully');
        setShowCreateDialog(false);
        resetForm();
        loadLinks();

        // Copy URL to clipboard
        navigator.clipboard.writeText(data.url);
        toast.success('Dashboard URL copied to clipboard');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create shareable dashboard');
      }
    } catch (error) {
      console.error('Error creating link:', error);
      toast.error('Failed to create shareable dashboard');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateLink = async () => {
    if (!editingLink) return;

    setIsCreating(true);

    try {
      const response = await fetch('/api/exports/shareable', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: editingLink.token,
          name: formData.name,
          description: formData.description,
          isActive: formData.isActive,
          expiresAt: formData.expiresAt?.toISOString(),
          allowedDomains: formData.allowedDomains,
          requiresPassword: formData.requiresPassword,
          password: formData.password || undefined,
        }),
      });

      if (response.ok) {
        toast.success('Shareable dashboard updated successfully');
        setShowCreateDialog(false);
        resetForm();
        loadLinks();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update shareable dashboard');
      }
    } catch (error) {
      console.error('Error updating link:', error);
      toast.error('Failed to update shareable dashboard');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteLink = async (token: string) => {
    if (!confirm('Are you sure you want to delete this shareable dashboard?')) {
      return;
    }

    try {
      const response = await fetch(`/api/exports/shareable?token=${token}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Shareable dashboard deleted successfully');
        loadLinks();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete shareable dashboard');
      }
    } catch (error) {
      console.error('Error deleting link:', error);
      toast.error('Failed to delete shareable dashboard');
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Dashboard URL copied to clipboard');
  };

  const handleEditLink = (link: ShareableLink) => {
    setFormData({
      name: link.name,
      description: link.description || '',
      dataTypes: link.dashboardConfig.dataTypes,
      dateRange: link.dashboardConfig.dateRange
        ? {
            from: new Date(link.dashboardConfig.dateRange.start),
            to: new Date(link.dashboardConfig.dateRange.end),
          }
        : undefined,
      includeDetails: link.dashboardConfig.includeDetails,
      expiresAt: link.expiresAt ? new Date(link.expiresAt) : undefined,
      allowedDomains: link.allowedDomains || [],
      requiresPassword: link.requiresPassword || false,
      password: '',
      isActive: link.isActive,
    });
    setEditingLink(link);
    setShowCreateDialog(true);
  };

  const toggleDataType = (dataType: string) => {
    setFormData(prev => ({
      ...prev,
      dataTypes: prev.dataTypes.includes(dataType)
        ? prev.dataTypes.filter(type => type !== dataType)
        : [...prev.dataTypes, dataType],
    }));
  };

  const addAllowedDomain = () => {
    setFormData(prev => ({
      ...prev,
      allowedDomains: [...prev.allowedDomains, ''],
    }));
  };

  const updateAllowedDomain = (index: number, domain: string) => {
    setFormData(prev => ({
      ...prev,
      allowedDomains: prev.allowedDomains.map((d, i) =>
        i === index ? domain : d,
      ),
    }));
  };

  const removeAllowedDomain = (index: number) => {
    setFormData(prev => ({
      ...prev,
      allowedDomains: prev.allowedDomains.filter((_, i) => i !== index),
    }));
  };

  const isLinkExpired = (expiresAt?: Date) => {
    return expiresAt && new Date() > expiresAt;
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Shareable Dashboards
            </CardTitle>
            <CardDescription>
              Create secure, shareable links to your analytics dashboards
            </CardDescription>
          </div>
          <Modal open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <ModalTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                New Dashboard
              </Button>
            </ModalTrigger>
            <ModalContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <ModalHeader>
                <ModalTitle>
                  {editingLink
                    ? 'Edit Shareable Dashboard'
                    : 'Create Shareable Dashboard'}
                </ModalTitle>
                <ModalDescription>
                  Set up a secure, shareable link to your analytics data
                </ModalDescription>
              </ModalHeader>

              <div className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="dashboardName">Dashboard Name</Label>
                    <Input
                      id="dashboardName"
                      placeholder="e.g., Q1 Job Search Analytics"
                      value={formData.name}
                      onChange={e =>
                        setFormData(prev => ({ ...prev, name: e.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief description of this dashboard"
                      value={formData.description}
                      onChange={e =>
                        setFormData(prev => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <Separator />

                {/* Data Configuration */}
                <div className="space-y-4">
                  <div>
                    <Label>Data Types to Include</Label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {dataTypeOptions.map(option => (
                        <div
                          key={option.value}
                          className="flex items-center space-x-2"
                        >
                          <input
                            type="checkbox"
                            id={option.value}
                            checked={formData.dataTypes.includes(option.value)}
                            onChange={() => toggleDataType(option.value)}
                            className="rounded border-gray-300"
                          />
                          <Label
                            htmlFor={option.value}
                            className="text-sm font-normal"
                          >
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Date Range (Optional)</Label>
                    <div className="mt-2">
                      <DatePickerWithRange
                        date={formData.dateRange}
                        onDateChange={date =>
                          setFormData(prev => ({ ...prev, dateRange: date }))
                        }
                        placeholder="Select date range (defaults to last 90 days)"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Include Detailed Data</div>
                      <div className="text-sm text-muted-foreground">
                        Include individual records and full details
                      </div>
                    </div>
                    <Switch
                      checked={formData.includeDetails}
                      onCheckedChange={checked =>
                        setFormData(prev => ({
                          ...prev,
                          includeDetails: checked,
                        }))
                      }
                    />
                  </div>
                </div>

                <Separator />

                {/* Security Settings */}
                <div className="space-y-4">
                  <div>
                    <Label>Expiration Date (Optional)</Label>
                    <Input
                      type="datetime-local"
                      value={
                        formData.expiresAt
                          ? format(formData.expiresAt, "yyyy-MM-dd'T'HH:mm")
                          : ''
                      }
                      onChange={e =>
                        setFormData(prev => ({
                          ...prev,
                          expiresAt: e.target.value
                            ? new Date(e.target.value)
                            : undefined,
                        }))
                      }
                      className="mt-2"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Leave empty for no expiration
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Password Protection</div>
                      <div className="text-sm text-muted-foreground">
                        Require a password to access this dashboard
                      </div>
                    </div>
                    <Switch
                      checked={formData.requiresPassword}
                      onCheckedChange={checked =>
                        setFormData(prev => ({
                          ...prev,
                          requiresPassword: checked,
                        }))
                      }
                    />
                  </div>

                  {formData.requiresPassword && (
                    <div>
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Enter a secure password"
                        value={formData.password}
                        onChange={e =>
                          setFormData(prev => ({
                            ...prev,
                            password: e.target.value,
                          }))
                        }
                      />
                    </div>
                  )}

                  <div>
                    <Label>Allowed Domains (Optional)</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Restrict access to specific domains
                    </p>
                    {formData.allowedDomains.map((domain, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <Input
                          placeholder="example.com"
                          value={domain}
                          onChange={e =>
                            updateAllowedDomain(index, e.target.value)
                          }
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeAllowedDomain(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addAllowedDomain}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Domain
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Status */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Active</div>
                    <div className="text-sm text-muted-foreground">
                      Enable access to this dashboard
                    </div>
                  </div>
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={checked =>
                      setFormData(prev => ({ ...prev, isActive: checked }))
                    }
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={editingLink ? handleUpdateLink : handleCreateLink}
                    disabled={isCreating}
                  >
                    {isCreating && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {editingLink ? 'Update' : 'Create'} Dashboard
                  </Button>
                </div>
              </div>
            </ModalContent>
          </Modal>
        </div>
      </CardHeader>
      <CardContent>
        {links.length === 0 ? (
          <div className="text-center py-8">
            <Share2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              No Shareable Dashboards
            </h3>
            <p className="text-muted-foreground mb-4">
              Create your first shareable dashboard to securely share your
              analytics data
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {links.map(link => (
              <div
                key={link.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold">{link.name}</h3>
                    <Badge variant={link.isActive ? 'default' : 'secondary'}>
                      {link.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    {link.requiresPassword && (
                      <Badge variant="outline">
                        <Lock className="h-3 w-3 mr-1" />
                        Protected
                      </Badge>
                    )}
                    {isLinkExpired(link.expiresAt) && (
                      <Badge variant="destructive">Expired</Badge>
                    )}
                  </div>

                  {link.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {link.description}
                    </p>
                  )}

                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Data:</span>{' '}
                    {link.dashboardConfig.dataTypes.join(', ')} •
                    <span className="font-medium ml-1">Views:</span>{' '}
                    {link.accessCount} •
                    <span className="font-medium ml-1">Created:</span>{' '}
                    {format(new Date(link.createdAt), 'MMM dd, yyyy')}
                    {link.expiresAt && (
                      <>
                        {' • '}
                        <span className="font-medium">Expires:</span>{' '}
                        {format(new Date(link.expiresAt), 'MMM dd, yyyy')}
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyUrl(link.url)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(link.url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditLink(link)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteLink(link.token)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
