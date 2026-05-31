"use client";

import { useState } from 'react';
import { 
  Bot, 
  Filter, 
  Eye, 
  Play, 
  CheckCircle, 
  ArrowRight,
  ArrowLeft,
  Settings
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  jobProviders: string[];
  keywords: string[];
  excludeKeywords: string[];
  salaryRange?: {
    min?: number;
    max?: number;
  };
  location?: string;
  jobType?: string;
  experienceLevel?: string;
}

export function AutomationSetupWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [rule, setRule] = useState<Partial<AutomationRule>>({
    name: '',
    enabled: true,
    jobProviders: [],
    keywords: [],
    excludeKeywords: [],
  });

  const steps = [
    { number: 1, title: 'Basic Setup', icon: Bot },
    { number: 2, title: 'Job Filters', icon: Filter },
    { number: 3, title: 'Review & Approve', icon: Eye },
    { number: 4, title: 'Activate', icon: Play },
  ];

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSaveRule = () => {
    // TODO: Implement API call to save automation rule
    console.log('Saving automation rule:', rule);
    setIsSetupComplete(true);
  };

  if (isSetupComplete) {
    return (
      <div className="text-center space-y-4">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
        <h3 className="text-lg font-semibold">Automation Setup Complete!</h3>
        <p className="text-sm text-muted-foreground">
          Your automation rule has been created and is ready to start applying to jobs.
        </p>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => setIsSetupComplete(false)} variant="outline">
            Create Another Rule
          </Button>
          <Button>
            <Play className="h-4 w-4 mr-2" />
            Start Automation
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.number;
          const isComplete = currentStep > step.number;
          
          return (
            <div key={step.number} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                isActive ? 'bg-primary text-primary-foreground' :
                isComplete ? 'bg-green-500 text-white' :
                'bg-muted text-muted-foreground'
              }`}>
                {isComplete ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              {index < steps.length - 1 && (
                <div className={`h-0.5 w-16 mx-2 ${
                  isComplete ? 'bg-green-500' : 'bg-muted'
                }`} />
              )}
            </div>
          );
        })}
      </div>

      <Separator />

      {/* Step Content */}
      <div className="min-h-[300px]">
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Basic Automation Setup</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Give your automation rule a name and configure basic settings.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="rule-name">Rule Name</Label>
                <Input
                  id="rule-name"
                  placeholder="e.g., Senior Developer Applications"
                  value={rule.name || ''}
                  onChange={(e) => setRule({ ...rule, name: e.target.value })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="enabled"
                  checked={rule.enabled}
                  onCheckedChange={(enabled) => setRule({ ...rule, enabled })}
                />
                <Label htmlFor="enabled">Enable this automation rule</Label>
              </div>

              <div>
                <Label>Job Boards</Label>
                <div className="mt-2 space-y-2">
                  {['LINKEDIN', 'INDEED', 'GLASSDOOR'].map((board) => (
                    <div key={board} className="flex items-center space-x-2">
                      <Switch
                        id={board}
                        checked={rule.jobProviders?.includes(board) || false}
                        onCheckedChange={(checked) => {
                          const boards = rule.jobProviders || [];
                          setRule({
                            ...rule,
                            jobProviders: checked
                              ? [...boards, board]
                              : boards.filter(b => b !== board)
                          });
                        }}
                      />
                      <Label htmlFor={board}>{board}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Job Filtering</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Configure filters to control which jobs the automation will apply to.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="keywords">Required Keywords (comma-separated)</Label>
                <Textarea
                  id="keywords"
                  placeholder="e.g., React, TypeScript, Node.js"
                  value={rule.keywords?.join(', ') || ''}
                  onChange={(e) => setRule({
                    ...rule,
                    keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean)
                  })}
                />
              </div>

              <div>
                <Label htmlFor="exclude-keywords">Exclude Keywords (comma-separated)</Label>
                <Textarea
                  id="exclude-keywords"
                  placeholder="e.g., PHP, .NET, Java"
                  value={rule.excludeKeywords?.join(', ') || ''}
                  onChange={(e) => setRule({
                    ...rule,
                    excludeKeywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean)
                  })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="min-salary">Min Salary</Label>
                  <Input
                    id="min-salary"
                    type="number"
                    placeholder="80000"
                    value={rule.salaryRange?.min || ''}
                    onChange={(e) => setRule({
                      ...rule,
                      salaryRange: {
                        ...rule.salaryRange,
                        min: e.target.value ? parseInt(e.target.value) : undefined
                      }
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="max-salary">Max Salary</Label>
                  <Input
                    id="max-salary"
                    type="number"
                    placeholder="150000"
                    value={rule.salaryRange?.max || ''}
                    onChange={(e) => setRule({
                      ...rule,
                      salaryRange: {
                        ...rule.salaryRange,
                        max: e.target.value ? parseInt(e.target.value) : undefined
                      }
                    })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="San Francisco, CA"
                  value={rule.location || ''}
                  onChange={(e) => setRule({ ...rule, location: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="job-type">Job Type</Label>
                <Select
                  value={rule.jobType || ''}
                  onValueChange={(jobType) => setRule({ ...rule, jobType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select job type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="remote">Remote</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Review & Preview</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Review your automation rule settings before activation.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{rule.name || 'Unnamed Rule'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-sm font-medium">Status: </span>
                  <Badge variant={rule.enabled ? "default" : "secondary"}>
                    {rule.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                
                <div>
                  <span className="text-sm font-medium">Job Boards: </span>
                  <span className="text-sm">{rule.jobProviders?.join(', ') || 'None selected'}</span>
                </div>
                
                {rule.keywords && rule.keywords.length > 0 && (
                  <div>
                    <span className="text-sm font-medium">Required Keywords: </span>
                    <span className="text-sm">{rule.keywords.join(', ')}</span>
                  </div>
                )}
                
                {rule.excludeKeywords && rule.excludeKeywords.length > 0 && (
                  <div>
                    <span className="text-sm font-medium">Exclude Keywords: </span>
                    <span className="text-sm">{rule.excludeKeywords.join(', ')}</span>
                  </div>
                )}
                
                {(rule.salaryRange?.min || rule.salaryRange?.max) && (
                  <div>
                    <span className="text-sm font-medium">Salary Range: </span>
                    <span className="text-sm">
                      ${rule.salaryRange.min?.toLocaleString() || '0'} - 
                      ${rule.salaryRange.max?.toLocaleString() || '∞'}
                    </span>
                  </div>
                )}
                
                {rule.location && (
                  <div>
                    <span className="text-sm font-medium">Location: </span>
                    <span className="text-sm">{rule.location}</span>
                  </div>
                )}
                
                {rule.jobType && (
                  <div>
                    <span className="text-sm font-medium">Job Type: </span>
                    <span className="text-sm">{rule.jobType}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4 text-center">
            <div>
              <h3 className="text-lg font-semibold mb-2">Ready to Activate</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your automation rule is configured and ready to start applying to jobs.
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> All applications will require your approval before being submitted.
                You can change this in the safety settings.
              </p>
            </div>

            <Button onClick={handleSaveRule} size="lg" className="w-full">
              <Play className="h-4 w-4 mr-2" />
              Create & Activate Rule
            </Button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={currentStep === 1}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        {currentStep < steps.length && (
          <Button
            onClick={nextStep}
            disabled={currentStep === 1 && !rule.name}
          >
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}