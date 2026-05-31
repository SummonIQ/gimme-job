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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  BarChart3,
  Copy,
  Edit,
  ExternalLink,
  Eye,
  FileText,
  Github,
  Image,
  MoreVertical,
  Plus,
  Share,
  TrendingUp,
  Wand2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Portfolio {
  id: string;
  title: string;
  description?: string;
  slug: string;
  template: string;
  theme: string;
  status: 'DRAFT' | 'PUBLISHED' | 'PRIVATE' | 'ARCHIVED';
  isDefault: boolean;
  viewCount: number;
  lastViewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  projectCount: number;
  analyticsEnabled: boolean;
}

interface PortfolioProject {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  technologies: string[];
  viewCount: number;
  githubUrl?: string;
  demoUrl?: string;
  aiEnhanced: boolean;
}

interface AnalyticsData {
  totalViews: number;
  uniqueVisitors: number;
  avgSessionDuration: number;
  bounceRate: number;
  viewsChange: number;
  isImprovement: boolean;
}

export function PortfolioDashboard() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(
    null,
  );
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPortfolio, setGeneratingPortfolio] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [syncingGithub, setSyncingGithub] = useState(false);

  // Portfolio creation form state
  const [createForm, setCreateForm] = useState({
    template: 'MODERN_TECH',
    theme: 'MINIMAL_LIGHT',
    targetRole: '',
    industry: '',
    personalStatement: '',
    selectedSkills: [] as string[],
  });

  useEffect(() => {
    loadPortfolios();
  }, []);

  useEffect(() => {
    if (selectedPortfolio) {
      loadPortfolioProjects(selectedPortfolio.id);
      loadPortfolioAnalytics(selectedPortfolio.id);
    }
  }, [selectedPortfolio]);

  const loadPortfolios = async () => {
    try {
      const response = await fetch('/api/portfolio/list');
      if (response.ok) {
        const data = await response.json();
        setPortfolios(data.portfolios);
        if (data.portfolios.length > 0 && !selectedPortfolio) {
          setSelectedPortfolio(data.portfolios[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load portfolios:', error);
      toast.error('Failed to load portfolios');
    } finally {
      setLoading(false);
    }
  };

  const loadPortfolioProjects = async (portfolioId: string) => {
    try {
      const response = await fetch(
        `/api/portfolio/projects?portfolioId=${portfolioId}`,
      );
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const loadPortfolioAnalytics = async (portfolioId: string) => {
    try {
      const response = await fetch(
        `/api/portfolio/analytics?portfolioId=${portfolioId}`,
      );
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  const generatePortfolio = async () => {
    setGeneratingPortfolio(true);
    try {
      const response = await fetch('/api/portfolio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(
          `Portfolio generated with ${data.projectsGenerated} projects!`,
        );
        setShowCreateDialog(false);
        loadPortfolios();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to generate portfolio');
      }
    } catch (error) {
      console.error('Portfolio generation failed:', error);
      toast.error('Failed to generate portfolio');
    } finally {
      setGeneratingPortfolio(false);
    }
  };

  const syncGithubRepos = async () => {
    setSyncingGithub(true);
    try {
      const response = await fetch('/api/portfolio/github/sync', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Synced ${data.syncedCount} repositories`);
        if (selectedPortfolio) {
          loadPortfolioProjects(selectedPortfolio.id);
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to sync GitHub repositories');
      }
    } catch (error) {
      console.error('GitHub sync failed:', error);
      toast.error('Failed to sync GitHub repositories');
    } finally {
      setSyncingGithub(false);
    }
  };

  const publishPortfolio = async (portfolioId: string) => {
    try {
      const response = await fetch(`/api/portfolio/${portfolioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PUBLISHED' }),
      });

      if (response.ok) {
        toast.success('Portfolio published successfully!');
        loadPortfolios();
      } else {
        toast.error('Failed to publish portfolio');
      }
    } catch (error) {
      console.error('Failed to publish portfolio:', error);
      toast.error('Failed to publish portfolio');
    }
  };

  const copyPortfolioLink = (slug: string) => {
    const url = `${window.location.origin}/portfolio/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Portfolio link copied to clipboard!');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return 'bg-green-100 text-green-800';
      case 'DRAFT':
        return 'bg-yellow-100 text-yellow-800';
      case 'PRIVATE':
        return 'bg-blue-100 text-blue-800';
      case 'ARCHIVED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Portfolio Management</h1>
          <p className="text-muted-foreground">
            Create, manage, and optimize your professional portfolios
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={syncGithubRepos}
            disabled={syncingGithub}
          >
            <Github className="h-4 w-4 mr-2" />
            {syncingGithub ? 'Syncing...' : 'Sync GitHub'}
          </Button>
          <Modal open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <ModalTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Portfolio
              </Button>
            </ModalTrigger>
            <ModalContent className="max-w-2xl">
              <ModalHeader>
                <ModalTitle>Generate AI-Powered Portfolio</ModalTitle>
                <ModalDescription>
                  Create a professional portfolio with AI-generated content
                  tailored to your career goals.
                </ModalDescription>
              </ModalHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="template">Template</Label>
                    <Select
                      value={createForm.template}
                      onValueChange={value =>
                        setCreateForm({ ...createForm, template: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MODERN_TECH">Modern Tech</SelectItem>
                        <SelectItem value="CREATIVE_DESIGNER">
                          Creative Designer
                        </SelectItem>
                        <SelectItem value="BUSINESS_PROFESSIONAL">
                          Business Professional
                        </SelectItem>
                        <SelectItem value="DATA_SCIENTIST">
                          Data Scientist
                        </SelectItem>
                        <SelectItem value="PRODUCT_MANAGER">
                          Product Manager
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="theme">Theme</Label>
                    <Select
                      value={createForm.theme}
                      onValueChange={value =>
                        setCreateForm({ ...createForm, theme: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MINIMAL_LIGHT">
                          Minimal Light
                        </SelectItem>
                        <SelectItem value="MINIMAL_DARK">
                          Minimal Dark
                        </SelectItem>
                        <SelectItem value="CREATIVE_COLORFUL">
                          Creative Colorful
                        </SelectItem>
                        <SelectItem value="PROFESSIONAL_BLUE">
                          Professional Blue
                        </SelectItem>
                        <SelectItem value="TECH_DARK">Tech Dark</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="targetRole">Target Role</Label>
                    <Input
                      id="targetRole"
                      placeholder="e.g., Senior Software Engineer"
                      value={createForm.targetRole}
                      onChange={e =>
                        setCreateForm({
                          ...createForm,
                          targetRole: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="industry">Industry</Label>
                    <Input
                      id="industry"
                      placeholder="e.g., Technology, Finance"
                      value={createForm.industry}
                      onChange={e =>
                        setCreateForm({
                          ...createForm,
                          industry: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="personalStatement">
                    Personal Statement (Optional)
                  </Label>
                  <Textarea
                    id="personalStatement"
                    placeholder="Brief personal statement to guide AI content generation..."
                    value={createForm.personalStatement}
                    onChange={e =>
                      setCreateForm({
                        ...createForm,
                        personalStatement: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <ModalFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                  disabled={generatingPortfolio}
                >
                  Cancel
                </Button>
                <Button
                  onClick={generatePortfolio}
                  disabled={generatingPortfolio}
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  {generatingPortfolio ? 'Generating...' : 'Generate Portfolio'}
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        </div>
      </div>

      {/* Portfolio Selection */}
      {portfolios.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {portfolios.map(portfolio => (
            <Card
              key={portfolio.id}
              className={`min-w-64 cursor-pointer transition-colors ${
                selectedPortfolio?.id === portfolio.id
                  ? 'ring-2 ring-primary'
                  : ''
              }`}
              onClick={() => setSelectedPortfolio(portfolio)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{portfolio.title}</CardTitle>
                  <Badge className={getStatusColor(portfolio.status)}>
                    {portfolio.status}
                  </Badge>
                </div>
                {portfolio.description && (
                  <CardDescription className="line-clamp-2">
                    {portfolio.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{portfolio.projectCount || 0} projects</span>
                  <span>{portfolio.viewCount} views</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Main Content */}
      {selectedPortfolio ? (
        <Tabs defaultValue="overview" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="projects">Projects</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyPortfolioLink(selectedPortfolio.slug)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              {selectedPortfolio.status === 'DRAFT' && (
                <Button
                  size="sm"
                  onClick={() => publishPortfolio(selectedPortfolio.id)}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Publish
                </Button>
              )}
            </div>
          </div>

          <TabsContent value="overview" className="space-y-4">
            {/* Analytics Overview */}
            {analytics && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Views
                    </CardTitle>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {analytics.totalViews}
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {analytics.isImprovement ? '+' : ''}
                      {analytics.viewsChange}% from last month
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Unique Visitors
                    </CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {analytics.uniqueVisitors}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {Math.round(
                        (analytics.uniqueVisitors / analytics.totalViews) * 100,
                      )}
                      % unique
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Avg. Session
                    </CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {Math.round(analytics.avgSessionDuration)}s
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {analytics.bounceRate < 0.5
                        ? 'Good engagement'
                        : 'Could improve'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Bounce Rate
                    </CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {Math.round(analytics.bounceRate * 100)}%
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {analytics.bounceRate < 0.4
                        ? 'Excellent'
                        : analytics.bounceRate < 0.6
                          ? 'Good'
                          : 'Needs improvement'}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Portfolio Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge
                    className={getStatusColor(selectedPortfolio.status)}
                    size="lg"
                  >
                    {selectedPortfolio.status}
                  </Badge>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Projects</span>
                      <span>{projects.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Template</span>
                      <span>
                        {selectedPortfolio.template.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Last Updated</span>
                      <span>
                        {new Date(
                          selectedPortfolio.updatedAt,
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">AI Enhancement</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>AI Enhanced Projects</span>
                      <span>
                        {projects.filter(p => p.aiEnhanced).length}/
                        {projects.length}
                      </span>
                    </div>
                    <Progress
                      value={
                        projects.length > 0
                          ? (projects.filter(p => p.aiEnhanced).length /
                              projects.length) *
                            100
                          : 0
                      }
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      {projects.filter(p => p.aiEnhanced).length ===
                      projects.length
                        ? 'All projects are AI-enhanced'
                        : 'Some projects could benefit from AI enhancement'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Documentation
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                    >
                      <Image className="h-4 w-4 mr-2" />
                      Enhance Visuals
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                    >
                      <Share className="h-4 w-4 mr-2" />
                      Share Portfolio
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">
                Projects ({projects.length})
              </h3>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Project
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map(project => (
                <Card key={project.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{project.title}</CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Project
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <FileText className="h-4 w-4 mr-2" />
                            Generate Documentation
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Image className="h-4 w-4 mr-2" />
                            Enhance Visuals
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardDescription className="line-clamp-2">
                      {project.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {project.technologies.slice(0, 3).map(tech => (
                          <Badge
                            key={tech}
                            variant="secondary"
                            className="text-xs"
                          >
                            {tech}
                          </Badge>
                        ))}
                        {project.technologies.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{project.technologies.length - 3} more
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <Badge
                            className={getStatusColor(project.status)}
                            size="sm"
                          >
                            {project.status}
                          </Badge>
                          {project.aiEnhanced && (
                            <Badge variant="secondary" size="sm">
                              AI Enhanced
                            </Badge>
                          )}
                        </span>
                        <span>{project.viewCount} views</span>
                      </div>
                      <div className="flex gap-2">
                        {project.githubUrl && (
                          <Button variant="outline" size="sm">
                            <Github className="h-4 w-4 mr-2" />
                            GitHub
                          </Button>
                        )}
                        {project.demoUrl && (
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Demo
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Portfolio Analytics</h3>
              <p className="text-muted-foreground">
                Detailed analytics dashboard would go here with charts and
                insights.
              </p>
              {/* Placeholder for full analytics dashboard */}
              <Card>
                <CardHeader>
                  <CardTitle>Coming Soon</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Comprehensive analytics including visitor demographics,
                    traffic sources, project performance, and conversion
                    tracking will be available here.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Portfolio Settings</h3>
              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="analytics-enabled">
                      Analytics Tracking
                    </Label>
                    <Switch
                      id="analytics-enabled"
                      checked={selectedPortfolio.analyticsEnabled}
                      onCheckedChange={() => {}}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="default-portfolio">Default Portfolio</Label>
                    <Switch
                      id="default-portfolio"
                      checked={selectedPortfolio.isDefault}
                      onCheckedChange={() => {}}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      ) : portfolios.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Portfolios Yet</CardTitle>
            <CardDescription>
              Create your first AI-powered portfolio to showcase your projects
              and skills.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Portfolio
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
