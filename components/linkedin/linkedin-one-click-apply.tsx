"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2, AlertCircle, CheckCircle2, Briefcase, MapPin, DollarSign, Clock, Users, Shield, Zap } from "lucide-react";
import { LinkedInJob, LinkedInApplicationData, LinkedInApplicationQuestion } from "@/lib/api/linkedin-jobs";

interface LinkedInOneClickApplyProps {
  job: LinkedInJob;
  applicationData: LinkedInApplicationData;
  onApply: (data: LinkedInApplicationData) => Promise<void>;
  onCancel: () => void;
}

export function LinkedInOneClickApply({
  job,
  applicationData: initialData,
  onApply,
  onCancel
}: LinkedInOneClickApplyProps) {
  const [applicationData, setApplicationData] = useState<LinkedInApplicationData>(initialData);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, any>>({});
  const [isApplying, setIsApplying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [applicationStatus, setApplicationStatus] = useState<"idle" | "applying" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  // Calculate application completeness
  const calculateCompleteness = () => {
    let required = 0;
    let completed = 0;

    // Check profile data completeness
    if (applicationData.profileData.firstName) completed++;
    required++;
    
    if (applicationData.profileData.lastName) completed++;
    required++;
    
    if (applicationData.profileData.email) completed++;
    required++;

    // Check required questions
    job.questions?.forEach(q => {
      if (q.required) {
        required++;
        if (questionAnswers[q.id]) completed++;
      }
    });

    return Math.round((completed / required) * 100);
  };

  const handleQuestionAnswer = (questionId: string, value: any) => {
    setQuestionAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
    
    // Clear error for this question
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[questionId];
      return newErrors;
    });
  };

  const validateApplication = () => {
    const newErrors: Record<string, string> = {};

    // Validate profile data
    if (!applicationData.profileData.firstName) {
      newErrors.firstName = "First name is required";
    }
    if (!applicationData.profileData.lastName) {
      newErrors.lastName = "Last name is required";
    }
    if (!applicationData.profileData.email) {
      newErrors.email = "Email is required";
    }

    // Validate required questions
    job.questions?.forEach(q => {
      if (q.required && !questionAnswers[q.id]) {
        newErrors[q.id] = `This question is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateApplication()) {
      setStatusMessage("Please complete all required fields");
      return;
    }

    setIsApplying(true);
    setApplicationStatus("applying");
    setStatusMessage("Submitting your application...");

    try {
      // Add question answers to application data
      const finalData = {
        ...applicationData,
        questionAnswers
      };

      await onApply(finalData);
      
      setApplicationStatus("success");
      setStatusMessage("Application submitted successfully!");
    } catch (error) {
      setApplicationStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "Failed to submit application");
    } finally {
      setIsApplying(false);
    }
  };

  const renderQuestion = (question: LinkedInApplicationQuestion) => {
    const error = errors[question.id];

    switch (question.type) {
      case "text":
        return (
          <div key={question.id} className="space-y-2">
            <Label htmlFor={question.id}>
              {question.question}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={question.id}
              value={questionAnswers[question.id] || ""}
              onChange={(e) => handleQuestionAnswer(question.id, e.target.value)}
              maxLength={question.maxLength}
              className={error ? "border-red-500" : ""}
              placeholder="Enter your answer..."
            />
            {question.maxLength && (
              <p className="text-xs text-muted-foreground">
                {(questionAnswers[question.id] || "").length}/{question.maxLength} characters
              </p>
            )}
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        );

      case "select":
        return (
          <div key={question.id} className="space-y-2">
            <Label htmlFor={question.id}>
              {question.question}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select
              value={questionAnswers[question.id] || ""}
              onValueChange={(value) => handleQuestionAnswer(question.id, value)}
            >
              <SelectTrigger className={error ? "border-red-500" : ""}>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {question.options?.map(option => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        );

      case "radio":
        return (
          <div key={question.id} className="space-y-2">
            <Label>
              {question.question}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <RadioGroup
              value={questionAnswers[question.id] || ""}
              onValueChange={(value) => handleQuestionAnswer(question.id, value)}
              className={error ? "border border-red-500 rounded p-2" : ""}
            >
              {question.options?.map(option => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                  <Label htmlFor={`${question.id}-${option}`}>{option}</Label>
                </div>
              ))}
            </RadioGroup>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        );

      case "checkbox":
        return (
          <div key={question.id} className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={question.id}
                checked={questionAnswers[question.id] || false}
                onCheckedChange={(checked) => handleQuestionAnswer(question.id, checked)}
                className={error ? "border-red-500" : ""}
              />
              <Label htmlFor={question.id}>
                {question.question}
                {question.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-2xl">{job.title}</CardTitle>
            <CardDescription className="text-base">
              {job.company.name}
            </CardDescription>
          </div>
          {job.easyApply && (
            <Badge className="bg-blue-100 text-blue-700">
              <Zap className="w-3 h-3 mr-1" />
              Easy Apply
            </Badge>
          )}
        </div>
        
        <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            {job.location.city ? `${job.location.city}, ${job.location.country}` : job.location.country}
            {job.location.remote && " (Remote)"}
          </div>
          {job.salary && (
            <div className="flex items-center gap-1">
              <DollarSign className="w-4 h-4" />
              {job.salary.currency} {job.salary.min?.toLocaleString()}-{job.salary.max?.toLocaleString()}
              {job.salary.period && ` per ${job.salary.period}`}
            </div>
          )}
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            Posted {new Date(job.postedAt).toLocaleDateString()}
          </div>
          {job.appliedCount && (
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {job.appliedCount} applicants
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Application Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Application Progress</span>
            <span className="font-medium">{calculateCompleteness()}% Complete</span>
          </div>
          <Progress value={calculateCompleteness()} className="h-2" />
        </div>

        {/* Application Status */}
        {applicationStatus !== "idle" && (
          <Alert className={
            applicationStatus === "success" ? "border-green-500" :
            applicationStatus === "error" ? "border-red-500" :
            "border-blue-500"
          }>
            {applicationStatus === "success" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            {applicationStatus === "error" && <AlertCircle className="h-4 w-4 text-red-500" />}
            {applicationStatus === "applying" && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
            <AlertTitle>
              {applicationStatus === "success" ? "Success!" :
               applicationStatus === "error" ? "Error" :
               "Processing"}
            </AlertTitle>
            <AlertDescription>{statusMessage}</AlertDescription>
          </Alert>
        )}

        {/* Application Form */}
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Profile Info</TabsTrigger>
            <TabsTrigger value="questions" disabled={!job.questions?.length}>
              Questions {job.questions?.length ? `(${job.questions.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="review">Review</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <div className="font-medium">{applicationData.profileData.firstName}</div>
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <div className="font-medium">{applicationData.profileData.lastName}</div>
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <div className="font-medium">{applicationData.profileData.email}</div>
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <div className="font-medium">{applicationData.profileData.phone || "Not provided"}</div>
              </div>
              <div className="space-y-2">
                <Label>LinkedIn Profile</Label>
                <div className="font-medium text-blue-600">
                  {applicationData.profileData.linkedInUrl || "Not provided"}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Years of Experience</Label>
                <div className="font-medium">{applicationData.profileData.yearsOfExperience || 0} years</div>
              </div>
            </div>

            {applicationData.profileData.headline && (
              <div className="space-y-2">
                <Label>Professional Headline</Label>
                <div className="font-medium">{applicationData.profileData.headline}</div>
              </div>
            )}

            {applicationData.profileData.skills && applicationData.profileData.skills.length > 0 && (
              <div className="space-y-2">
                <Label>Skills</Label>
                <div className="flex flex-wrap gap-2">
                  {applicationData.profileData.skills.slice(0, 10).map(skill => (
                    <Badge key={skill} variant="secondary">{skill}</Badge>
                  ))}
                  {applicationData.profileData.skills.length > 10 && (
                    <Badge variant="outline">+{applicationData.profileData.skills.length - 10} more</Badge>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="questions" className="space-y-4 mt-4">
            {job.questions && job.questions.length > 0 ? (
              job.questions.map(question => renderQuestion(question))
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No additional questions required for this application
              </p>
            )}
          </TabsContent>

          <TabsContent value="review" className="space-y-4 mt-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>Application Review</AlertTitle>
              <AlertDescription>
                Please review your application before submitting. Once submitted, you cannot modify your application.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-medium">Application Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Applicant: {applicationData.profileData.firstName} {applicationData.profileData.lastName}</div>
                  <div>Email: {applicationData.profileData.email}</div>
                  <div>Experience: {applicationData.profileData.yearsOfExperience} years</div>
                  <div>Resume: {applicationData.resumeId ? "Attached" : "Using LinkedIn Profile"}</div>
                </div>
              </div>

              {job.questions && job.questions.length > 0 && (
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="font-medium">Question Responses</h4>
                  <div className="space-y-2 text-sm">
                    {job.questions.map(q => (
                      <div key={q.id}>
                        <span className="font-medium">{q.question}:</span>{" "}
                        <span className="text-muted-foreground">
                          {questionAnswers[q.id] || "Not answered"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Alert className="border-blue-200 bg-blue-50">
                <Briefcase className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900">
                  By submitting this application, you confirm that all information provided is accurate and complete.
                  This application will be submitted directly through LinkedIn.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isApplying}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isApplying || applicationStatus === "success"}
          className="min-w-[120px]"
        >
          {isApplying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Applying...
            </>
          ) : applicationStatus === "success" ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Applied
            </>
          ) : (
            "Submit Application"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}