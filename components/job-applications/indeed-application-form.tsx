"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAnalytics } from "@summoniq/signalsplash-client-sdk/react";
import { Button } from "@/components/ui/button";
import { FormErrorSummary } from "@/components/forms/form-error-summary";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Briefcase, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useFormErrorHandling } from "@/lib/a11y/form-utils";

interface IndeedApplicationFormProps {
  jobLeadId: string;
  jobTitle: string;
  company: string;
  resumeOptions: { id: string; name: string }[];
  coverLetterOptions?: { id: string; name: string }[];
}

// Form validation schema
const formSchema = z.object({
  resumeId: z.string({
    required_error: "Please select a resume",
  }),
  coverLetterId: z.string().optional(),
  includePhone: z.boolean().default(true),
  includeAddress: z.boolean().default(true),
  customFields: z.object({
    yearsOfExperience: z.string().optional(),
    willRelocate: z.boolean().default(false),
    salaryExpectation: z.string().optional(),
    workAuthorization: z.enum(["citizen", "permanent_resident", "work_visa", "require_sponsorship"]).optional(),
    startDate: z.string().optional(),
  }).optional(),
  additionalNotes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function IndeedApplicationForm({
  jobLeadId,
  jobTitle,
  company,
  resumeOptions,
  coverLetterOptions = [],
}: IndeedApplicationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSucceeded, setHasSucceeded] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { track } = useAnalytics();
  
  // Initialize form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      includePhone: true,
      includeAddress: true,
      customFields: {
        willRelocate: false,
      },
      additionalNotes: "",
    },
  });
  const {
    errorEntries,
    errorSummaryRef,
    focusField,
    handleInvalid,
    showSummary,
  } = useFormErrorHandling(form);
  
  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    
    try {
      const response = await fetch("/api/applications/indeed/submit", {
        body: JSON.stringify({
          additionalInfo: {
            ...data.customFields,
            includePhone: data.includePhone,
            includeAddress: data.includeAddress,
            additionalNotes: data.additionalNotes,
          },
          coverLetterId: data.coverLetterId,
          jobLeadId,
          resumeId: data.resumeId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const result = (await response.json()) as {
        applicationId?: string;
        error?: string;
        message?: string;
        success: boolean;
      };
      
      if (response.ok && result.success) {
        track('application_submitted', {
          job_id: jobLeadId,
          source: 'indeed',
          has_resume: Boolean(data.resumeId),
          has_cover_letter: Boolean(data.coverLetterId),
        });
        toast({
          title: "Application submitted",
          description: `Your application for ${jobTitle} at ${company} has been submitted successfully.`,
        });
        setHasSucceeded(true);
        router.refresh();
        
        // Redirect to application tracking after a short delay
        setTimeout(() => {
          router.push("/applications");
        }, 2000);
      } else {
        toast({
          variant: "destructive",
          title: "Application failed",
          description: result.error || result.message || "There was a problem submitting your application. Please try again.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Application failed",
        description: error instanceof Error 
          ? error.message 
          : "There was a problem submitting your application. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Redirect user if no resumes available
  useEffect(() => {
    if (resumeOptions.length === 0) {
      toast({
        variant: "destructive",
        title: "No resumes available",
        description: "You need to create a resume before applying to jobs.",
      });
      
      router.push("/resumes/new");
    }
  }, [resumeOptions.length, router, toast]);
  
  if (hasSucceeded) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <div className="rounded-full bg-green-100 p-3 mb-4">
          <Briefcase className="h-6 w-6 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Application Submitted!</h3>
        <p className="text-muted-foreground mb-4">
          Your application for {jobTitle} at {company} has been submitted successfully.
        </p>
        <p className="text-sm text-muted-foreground">
          Redirecting to your applications...
        </p>
      </div>
    );
  }
  
  return (
    <Form {...form}>
      <form
        className="space-y-6"
        noValidate
        onSubmit={form.handleSubmit(onSubmit, handleInvalid)}
      >
        <FormErrorSummary
          errors={errorEntries}
          heading="We need a few required selections before submitting to Indeed:"
          onSelect={focusField}
          ref={errorSummaryRef}
          visible={showSummary}
        />
        <FormField
          control={form.control}
          name="resumeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Resume</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a resume" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {resumeOptions.map((resume) => (
                    <SelectItem key={resume.id} value={resume.id}>
                      {resume.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Choose which resume to use for this application
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {coverLetterOptions.length > 0 && (
          <FormField
            control={form.control}
            name="coverLetterId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cover Letter (Optional)</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a cover letter" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {coverLetterOptions.map((letter) => (
                      <SelectItem key={letter.id} value={letter.id}>
                        {letter.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Including a cover letter can increase your chances
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="space-y-3">
          <h3 className="text-sm font-medium">Contact Information</h3>
          
          <FormField
            control={form.control}
            name="includePhone"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>
                    Include phone number
                  </FormLabel>
                  <FormDescription>
                    Allow employers to contact you by phone
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="includeAddress"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>
                    Include address
                  </FormLabel>
                  <FormDescription>
                    Share your location with the employer
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium">Additional Information (Optional)</h3>
          
          <FormField
            control={form.control}
            name="customFields.yearsOfExperience"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Years of Experience</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. 3" {...field} />
                </FormControl>
                <FormDescription>
                  Years of relevant experience for this role
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="customFields.willRelocate"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>
                    Willing to relocate
                  </FormLabel>
                  <FormDescription>
                    Indicate if you're open to relocating for this role
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="customFields.salaryExpectation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Salary Expectation</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. $80,000 - $100,000" {...field} />
                </FormControl>
                <FormDescription>
                  Your salary expectations for this role
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="customFields.workAuthorization"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Work Authorization</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select authorization status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="citizen">US Citizen</SelectItem>
                    <SelectItem value="permanent_resident">Permanent Resident</SelectItem>
                    <SelectItem value="work_visa">Work Visa</SelectItem>
                    <SelectItem value="require_sponsorship">Require Sponsorship</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="customFields.startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Available Start Date</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Immediately, 2 weeks, MM/DD/YYYY" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="additionalNotes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Additional Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any additional information you want to include with your application"
                  className="min-h-24 resize-y"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                This information will be used when answering screening questions
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="pt-4 flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? "Submitting..." : "Submit Application"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
