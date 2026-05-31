'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { JobProvider } from '@/generated/prisma/browser';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Briefcase,
  Building,
  CheckCircle,
  Clock,
  ExternalLink,
  Globe,
  Info,
  Search,
  Users,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface PlatformInfo {
  platform: JobProvider;
  name: string;
  capabilities: {
    automationSupported: boolean;
    confidenceLevel: 'high' | 'medium' | 'low';
    features: string[];
    limitations: string[];
  };
  requiredFields: string[];
  totalFields: number;
  implementationStatus: 'implemented' | 'planned';
}

interface PlatformDetection {
  platform: JobProvider;
  confidence: number;
  indicators: string[];
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  LINKEDIN: <Users className="h-5 w-5 text-blue-600" />,
  INDEED: <Briefcase className="h-5 w-5 text-blue-800" />,
  GLASSDOOR: <Building className="h-5 w-5 text-green-600" />,
  ZIPRECRUITER: <Zap className="h-5 w-5 text-orange-600" />,
  ANGELLIST: <Globe className="h-5 w-5 text-purple-600" />,
  WELLFOUND: <Globe className="h-5 w-5 text-purple-600" />,
  COMPANY_DIRECT: <Building className="h-5 w-5 text-gray-600" />,
  SERPAPI: <Search className="h-5 w-5 text-red-600" />,
};

export function MultiPlatformDashboard() {
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [urlInput, setUrlInput] = useState('');
  const [detection, setDetection] = useState<PlatformDetection | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformInfo | null>(
    null,
  );

  useEffect(() => {
    fetchPlatforms();
  }, []);

  const fetchPlatforms = async () => {
    try {
      const response = await fetch('/api/automation/platforms?action=list');
      const data = await response.json();
      setPlatforms(data.platforms || []);
    } catch (error) {
      console.error('Error fetching platforms:', error);
    } finally {
      setLoading(false);
    }
  };

  const detectPlatform = async () => {
    if (!urlInput.trim()) return;

    try {
      const response = await fetch(
        `/api/automation/platforms?action=detect&jobUrl=${encodeURIComponent(urlInput)}`,
      );
      const data = await response.json();
      setDetection(data.detection);
    } catch (error) {
      console.error('Error detecting platform:', error);
    }
  };

  const getStatusBadge = (status: string, confidence?: number) => {
    if (status === 'implemented') {
      return (
        <Badge variant="success" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Implemented
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Planned
        </Badge>
      );
    }
  };

  const getConfidenceBadge = (level: string) => {
    const colors = {
      high: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-red-100 text-red-800',
    };

    return (
      <Badge className={colors[level as keyof typeof colors] || colors.low}>
        {level} confidence
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            Loading platform information...
          </p>
        </div>
      </div>
    );
  }

  const implementedPlatforms = platforms.filter(
    p => p.implementationStatus === 'implemented',
  );
  const plannedPlatforms = platforms.filter(
    p => p.implementationStatus === 'planned',
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold">
          Multi-Platform Application Integration
        </h2>
        <p className="text-muted-foreground mt-2">
          Automate job applications across {platforms.length} different
          platforms with intelligent detection and field mapping.
        </p>
      </div>

      {/* Platform Detection Tool */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Platform Detection Tool
          </CardTitle>
          <CardDescription>
            Test our platform detection by entering a job posting URL
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="https://example.com/jobs/software-engineer"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              className="flex-1"
            />
            <Button onClick={detectPlatform} disabled={!urlInput.trim()}>
              Detect Platform
            </Button>
          </div>

          {detection && (
            <Alert className="mt-4">
              <Info className="h-4 w-4" />
              <AlertTitle>Platform Detected: {detection.platform}</AlertTitle>
              <AlertDescription>
                <div className="mt-2">
                  <p className="mb-2">Confidence: {detection.confidence}%</p>
                  <Progress value={detection.confidence} className="mb-2" />
                  <div className="text-sm">
                    <strong>Indicators:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {detection.indicators.map((indicator, index) => (
                        <li key={index}>{indicator}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="implemented" className="space-y-4">
        <TabsList>
          <TabsTrigger value="implemented">
            Implemented Platforms ({implementedPlatforms.length})
          </TabsTrigger>
          <TabsTrigger value="planned">
            Planned Platforms ({plannedPlatforms.length})
          </TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="implemented" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {implementedPlatforms.map(platform => (
              <PlatformCard
                key={platform.platform}
                platform={platform}
                onSelect={setSelectedPlatform}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="planned" className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Coming Soon</AlertTitle>
            <AlertDescription>
              These platforms are planned for future implementation. They will
              be added to our automation capabilities in upcoming releases.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plannedPlatforms.map(platform => (
              <PlatformCard
                key={platform.platform}
                platform={platform}
                onSelect={setSelectedPlatform}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Platforms
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{platforms.length}</div>
                <p className="text-xs text-muted-foreground">
                  Major job boards and company sites
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Implemented
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {implementedPlatforms.length}
                </div>
                <Progress
                  value={(implementedPlatforms.length / platforms.length) * 100}
                  className="mt-2"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  High Confidence
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {
                    implementedPlatforms.filter(
                      p => p.capabilities.confidenceLevel === 'high',
                    ).length
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  Platforms with high automation success rates
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Platform Coverage</CardTitle>
              <CardDescription>
                Automation capabilities across different job platforms
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {platforms.slice(0, 8).map(platform => (
                  <div
                    key={platform.platform}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {PLATFORM_ICONS[platform.platform]}
                      <span className="font-medium">{platform.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(platform.implementationStatus)}
                      {platform.implementationStatus === 'implemented' &&
                        getConfidenceBadge(
                          platform.capabilities.confidenceLevel,
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Platform Details Dialog */}
      <Modal
        open={!!selectedPlatform}
        onOpenChange={() => setSelectedPlatform(null)}
      >
        <ModalContent className="max-w-2xl">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2">
              {selectedPlatform && PLATFORM_ICONS[selectedPlatform.platform]}
              {selectedPlatform?.name} Integration
            </ModalTitle>
            <ModalDescription>
              Detailed automation capabilities and requirements
            </ModalDescription>
          </ModalHeader>

          {selectedPlatform && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {getStatusBadge(selectedPlatform.implementationStatus)}
                {selectedPlatform.implementationStatus === 'implemented' &&
                  getConfidenceBadge(
                    selectedPlatform.capabilities.confidenceLevel,
                  )}
              </div>

              <div>
                <h4 className="font-medium mb-2">Features</h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {selectedPlatform.capabilities.features.map(
                    (feature, index) => (
                      <li key={index}>{feature}</li>
                    ),
                  )}
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">Limitations</h4>
                <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                  {selectedPlatform.capabilities.limitations.map(
                    (limitation, index) => (
                      <li key={index}>{limitation}</li>
                    ),
                  )}
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">Required Information</h4>
                <div className="flex flex-wrap gap-1">
                  {selectedPlatform.requiredFields.map(field => (
                    <Badge key={field} variant="outline">
                      {field.replace(/([A-Z])/g, ' $1').trim()}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {selectedPlatform.totalFields} total fields supported
                </p>
              </div>
            </div>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}

function PlatformCard({
  platform,
  onSelect,
}: {
  platform: PlatformInfo;
  onSelect: (platform: PlatformInfo) => void;
}) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        platform.implementationStatus === 'planned' && 'opacity-75',
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {PLATFORM_ICONS[platform.platform]}
            <CardTitle className="text-base">{platform.name}</CardTitle>
          </div>
          {platform.implementationStatus === 'implemented' ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <Clock className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>Automation Support</span>
            <Badge
              variant={
                platform.capabilities.automationSupported
                  ? 'success'
                  : 'secondary'
              }
            >
              {platform.capabilities.automationSupported ? 'Yes' : 'Planned'}
            </Badge>
          </div>

          {platform.capabilities.automationSupported && (
            <div className="flex items-center justify-between text-sm">
              <span>Confidence Level</span>
              <Badge
                className={cn(
                  platform.capabilities.confidenceLevel === 'high' &&
                    'bg-green-100 text-green-800',
                  platform.capabilities.confidenceLevel === 'medium' &&
                    'bg-yellow-100 text-yellow-800',
                  platform.capabilities.confidenceLevel === 'low' &&
                    'bg-red-100 text-red-800',
                )}
              >
                {platform.capabilities.confidenceLevel}
              </Badge>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span>Required Fields</span>
            <span className="text-muted-foreground">
              {platform.requiredFields.length}
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3"
            onClick={() => onSelect(platform)}
          >
            View Details
            <ExternalLink className="ml-2 h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
