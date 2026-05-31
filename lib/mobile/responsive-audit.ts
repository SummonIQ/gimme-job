"use server";

import { db } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user/query";

/**
 * Mobile Responsiveness Audit Types
 */
export interface ResponsivenessIssue {
  component: string;
  path: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  suggestedFix: string;
}

interface AuditResult {
  timestamp: Date;
  issues: ResponsivenessIssue[];
  score: number; // 0-100
  totalComponents: number;
  issuesByCategory: {
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * List of critical paths to check for mobile responsiveness
 */
const CRITICAL_PATHS = [
  { path: '/dashboard', component: 'Dashboard' },
  { path: '/jobs', component: 'Jobs List' },
  { path: '/leads', component: 'Job Leads' },
  { path: '/applications', component: 'Applications' },
  { path: '/resumes', component: 'Resumes' },
  { path: '/interviews', component: 'Interviews' },
  { path: '/networking', component: 'Networking' },
  { path: '/analytics', component: 'Analytics' },
  { path: '/notifications', component: 'Notifications' },
  { path: '/settings', component: 'Settings' },
];

/**
 * Run a mobile responsiveness audit on the application
 */
export async function runResponsivenessAudit(): Promise<AuditResult> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  // Initialize the audit result
  const audit: AuditResult = {
    timestamp: new Date(),
    issues: [],
    score: 0,
    totalComponents: CRITICAL_PATHS.length,
    issuesByCategory: {
      high: 0,
      medium: 0,
      low: 0,
    },
  };

  // Here we're simulating an audit by providing known issues
  // In a real application, this would be done via automated testing or API calls to a testing service
  const knownIssues: ResponsivenessIssue[] = [
    {
      component: 'Analytics',
      path: '/analytics',
      severity: 'high',
      description: 'Charts don\'t resize properly on mobile screens, causing horizontal scrolling',
      suggestedFix: 'Use responsive chart options and container queries to adjust chart dimensions',
    },
    {
      component: 'Job Leads',
      path: '/leads',
      severity: 'medium',
      description: 'Table columns overflow on small screens',
      suggestedFix: 'Implement responsive tables with column priority or card view on mobile',
    },
    {
      component: 'Notifications',
      path: '/notifications',
      severity: 'low',
      description: 'Filter buttons stack awkwardly on small screens',
      suggestedFix: 'Convert filter buttons to a dropdown menu on mobile screens',
    },
    {
      component: 'Top Navigation',
      path: 'global',
      severity: 'high',
      description: 'Navigation items overflow and break layout on small screens',
      suggestedFix: 'Implement a hamburger menu or bottom navigation for mobile screens',
    },
    {
      component: 'Resumes',
      path: '/resumes',
      severity: 'medium',
      description: 'Resume previews don\'t scale properly on mobile',
      suggestedFix: 'Add mobile-specific styling for resume previews with proper scaling',
    },
  ];

  // Add the known issues to the audit result
  audit.issues = knownIssues;

  // Count issues by severity
  audit.issuesByCategory.high = knownIssues.filter(issue => issue.severity === 'high').length;
  audit.issuesByCategory.medium = knownIssues.filter(issue => issue.severity === 'medium').length;
  audit.issuesByCategory.low = knownIssues.filter(issue => issue.severity === 'low').length;

  // Calculate the mobile responsiveness score
  // Formula: 100 - (high * 20) - (medium * 10) - (low * 5)
  const score = 100 - 
    (audit.issuesByCategory.high * 20) - 
    (audit.issuesByCategory.medium * 10) - 
    (audit.issuesByCategory.low * 5);
  
  audit.score = Math.max(0, Math.min(100, score));

  // Save the audit result to the database
  await db.mobileResponsivenessAudit.create({
    data: {
      userId: user.id,
      score: audit.score,
      highSeverityIssues: audit.issuesByCategory.high,
      mediumSeverityIssues: audit.issuesByCategory.medium,
      lowSeverityIssues: audit.issuesByCategory.low,
      totalIssues: audit.issues.length,
      auditData: JSON.stringify(audit),
    },
  });

  return audit;
}

/**
 * Get the latest mobile responsiveness audit
 */
export async function getLatestResponsivenessAudit(): Promise<AuditResult | null> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  const latestAudit = await db.mobileResponsivenessAudit.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  if (!latestAudit) {
    return null;
  }

  return JSON.parse(latestAudit.auditData as string) as AuditResult;
}
