import { db } from '@/lib/db/client';
import { 
  ApplicationStatus, 
  type ApplicationSubmission,
  type AutomationAuditLog
} from '@/generated/prisma/browser';
import { differenceInMinutes, addMinutes } from 'date-fns';
import { sendNotification } from '@/lib/notifications';
import { IntelligentScheduler } from './intelligent-scheduler';

// Error categorization types
export enum ErrorCategory {
  TEMPORARY = 'temporary',      // Network issues, rate limits, timeouts
  PERMANENT = 'permanent',       // Invalid credentials, unsupported platform
  AUTHENTICATION = 'auth',       // Auth failures that may need user action
  VALIDATION = 'validation',     // Form validation errors
  PLATFORM = 'platform',         // Platform-specific errors
  UNKNOWN = 'unknown'           // Uncategorized errors
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  applicationId?: string;
  jobLeadId?: string;
  platform?: string;
  attemptNumber?: number;
  lastError?: string;
  metadata?: Record<string, any>;
  userId: string;
}

export interface RetryStrategy {
  maxAttempts: number;
  baseDelayMinutes: number;
  maxDelayMinutes: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
}

export interface ErrorResolution {
  category: ErrorCategory;
  severity: ErrorSeverity;
  isRetryable: boolean;
  requiresUserAction: boolean;
  suggestedAction?: string;
  autoResolvable: boolean;
  retryStrategy?: RetryStrategy;
}

export interface ErrorLog {
  id: string;
  timestamp: Date;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  stackTrace?: string;
  context: ErrorContext;
  resolution: ErrorResolution;
  resolved: boolean;
  resolvedAt?: Date;
  resolutionMethod?: string;
}

// Error patterns for categorization
const ERROR_PATTERNS: Record<string, { category: ErrorCategory; severity: ErrorSeverity }> = {
  // Network and connectivity
  'ECONNREFUSED': { category: ErrorCategory.TEMPORARY, severity: ErrorSeverity.MEDIUM },
  'ETIMEDOUT': { category: ErrorCategory.TEMPORARY, severity: ErrorSeverity.MEDIUM },
  'ENOTFOUND': { category: ErrorCategory.TEMPORARY, severity: ErrorSeverity.MEDIUM },
  'Network request failed': { category: ErrorCategory.TEMPORARY, severity: ErrorSeverity.MEDIUM },
  'timeout': { category: ErrorCategory.TEMPORARY, severity: ErrorSeverity.LOW },
  
  // Rate limiting
  'rate limit': { category: ErrorCategory.TEMPORARY, severity: ErrorSeverity.LOW },
  '429': { category: ErrorCategory.TEMPORARY, severity: ErrorSeverity.LOW },
  'too many requests': { category: ErrorCategory.TEMPORARY, severity: ErrorSeverity.LOW },
  
  // Authentication
  '401': { category: ErrorCategory.AUTHENTICATION, severity: ErrorSeverity.HIGH },
  '403': { category: ErrorCategory.AUTHENTICATION, severity: ErrorSeverity.HIGH },
  'unauthorized': { category: ErrorCategory.AUTHENTICATION, severity: ErrorSeverity.HIGH },
  'forbidden': { category: ErrorCategory.AUTHENTICATION, severity: ErrorSeverity.HIGH },
  'invalid credentials': { category: ErrorCategory.AUTHENTICATION, severity: ErrorSeverity.CRITICAL },
  'token expired': { category: ErrorCategory.AUTHENTICATION, severity: ErrorSeverity.HIGH },
  
  // Validation
  'validation failed': { category: ErrorCategory.VALIDATION, severity: ErrorSeverity.MEDIUM },
  'required field': { category: ErrorCategory.VALIDATION, severity: ErrorSeverity.MEDIUM },
  'invalid format': { category: ErrorCategory.VALIDATION, severity: ErrorSeverity.MEDIUM },
  '400': { category: ErrorCategory.VALIDATION, severity: ErrorSeverity.MEDIUM },
  
  // Platform specific
  'linkedin': { category: ErrorCategory.PLATFORM, severity: ErrorSeverity.MEDIUM },
  'indeed': { category: ErrorCategory.PLATFORM, severity: ErrorSeverity.MEDIUM },
  'glassdoor': { category: ErrorCategory.PLATFORM, severity: ErrorSeverity.MEDIUM },
  'platform error': { category: ErrorCategory.PLATFORM, severity: ErrorSeverity.MEDIUM },
  
  // Permanent errors
  '404': { category: ErrorCategory.PERMANENT, severity: ErrorSeverity.HIGH },
  'not found': { category: ErrorCategory.PERMANENT, severity: ErrorSeverity.HIGH },
  'job expired': { category: ErrorCategory.PERMANENT, severity: ErrorSeverity.MEDIUM },
  'position filled': { category: ErrorCategory.PERMANENT, severity: ErrorSeverity.MEDIUM },
  'application closed': { category: ErrorCategory.PERMANENT, severity: ErrorSeverity.MEDIUM },
};

// Retry strategies for different error categories
const RETRY_STRATEGIES: Record<ErrorCategory, RetryStrategy> = {
  [ErrorCategory.TEMPORARY]: {
    maxAttempts: 5,
    baseDelayMinutes: 5,
    maxDelayMinutes: 120,
    backoffMultiplier: 2,
    jitterEnabled: true,
  },
  [ErrorCategory.AUTHENTICATION]: {
    maxAttempts: 2,
    baseDelayMinutes: 1,
    maxDelayMinutes: 5,
    backoffMultiplier: 1,
    jitterEnabled: false,
  },
  [ErrorCategory.PLATFORM]: {
    maxAttempts: 3,
    baseDelayMinutes: 10,
    maxDelayMinutes: 60,
    backoffMultiplier: 1.5,
    jitterEnabled: true,
  },
  [ErrorCategory.VALIDATION]: {
    maxAttempts: 1,
    baseDelayMinutes: 0,
    maxDelayMinutes: 0,
    backoffMultiplier: 1,
    jitterEnabled: false,
  },
  [ErrorCategory.PERMANENT]: {
    maxAttempts: 0,
    baseDelayMinutes: 0,
    maxDelayMinutes: 0,
    backoffMultiplier: 1,
    jitterEnabled: false,
  },
  [ErrorCategory.UNKNOWN]: {
    maxAttempts: 2,
    baseDelayMinutes: 15,
    maxDelayMinutes: 60,
    backoffMultiplier: 2,
    jitterEnabled: true,
  },
};

export class AutomationErrorHandler {
  private errorLogs: Map<string, ErrorLog[]> = new Map();
  private manualInterventionQueue: Set<string> = new Set();
  private consecutiveFailures: Map<string, number> = new Map();

  /**
   * Main error handling entry point
   */
  async handleError(
    error: Error | unknown,
    context: ErrorContext
  ): Promise<ErrorResolution> {
    // Categorize the error
    const categorization = this.categorizeError(error);
    
    // Determine resolution strategy
    const resolution = this.determineResolution(categorization, context);
    
    // Log the error
    const errorLog = await this.logError(error, categorization, context, resolution);
    
    // Track consecutive failures
    this.trackConsecutiveFailures(context.userId, resolution.category);
    
    // Handle based on resolution strategy
    if (resolution.isRetryable && context.attemptNumber! < resolution.retryStrategy!.maxAttempts) {
      await this.scheduleRetry(context, resolution);
    } else if (resolution.requiresUserAction) {
      await this.addToManualInterventionQueue(context, errorLog);
    }
    
    // Send notifications if needed
    if (resolution.severity === ErrorSeverity.CRITICAL || resolution.severity === ErrorSeverity.HIGH) {
      await this.sendErrorNotification(context, errorLog);
    }
    
    // Attempt auto-resolution if possible
    if (resolution.autoResolvable) {
      await this.attemptAutoResolution(errorLog, context);
    }
    
    // Update application status
    if (context.applicationId) {
      await this.updateApplicationStatus(context.applicationId, resolution);
    }
    
    return resolution;
  }

  /**
   * Categorize error based on patterns
   */
  private categorizeError(error: Error | unknown): { category: ErrorCategory; severity: ErrorSeverity } {
    const errorMessage = this.extractErrorMessage(error).toLowerCase();
    
    // Check against known patterns
    for (const [pattern, categorization] of Object.entries(ERROR_PATTERNS)) {
      if (errorMessage.includes(pattern.toLowerCase())) {
        return categorization;
      }
    }
    
    // Check for HTTP status codes
    if (error instanceof Error && 'status' in error) {
      const status = (error as any).status;
      if (status >= 500) {
        return { category: ErrorCategory.TEMPORARY, severity: ErrorSeverity.MEDIUM };
      }
    }
    
    // Default to unknown
    return { category: ErrorCategory.UNKNOWN, severity: ErrorSeverity.MEDIUM };
  }

  /**
   * Determine resolution strategy
   */
  private determineResolution(
    categorization: { category: ErrorCategory; severity: ErrorSeverity },
    context: ErrorContext
  ): ErrorResolution {
    const { category, severity } = categorization;
    const retryStrategy = RETRY_STRATEGIES[category];
    
    // Check if we've exceeded retry attempts
    const attemptNumber = context.attemptNumber || 0;
    const isRetryable = retryStrategy.maxAttempts > 0 && attemptNumber < retryStrategy.maxAttempts;
    
    // Determine if user action is required
    const requiresUserAction = 
      category === ErrorCategory.AUTHENTICATION ||
      category === ErrorCategory.PERMANENT ||
      (category === ErrorCategory.VALIDATION && attemptNumber > 0);
    
    // Check if auto-resolvable
    const autoResolvable = this.isAutoResolvable(category, context);
    
    // Suggest action based on category
    const suggestedAction = this.getSuggestedAction(category, context);
    
    return {
      category,
      severity,
      isRetryable,
      requiresUserAction,
      suggestedAction,
      autoResolvable,
      retryStrategy: isRetryable ? retryStrategy : undefined,
    };
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(
    attemptNumber: number,
    strategy: RetryStrategy
  ): number {
    // Calculate base delay with exponential backoff
    let delay = strategy.baseDelayMinutes * Math.pow(strategy.backoffMultiplier, attemptNumber - 1);
    
    // Apply maximum delay cap
    delay = Math.min(delay, strategy.maxDelayMinutes);
    
    // Add jitter if enabled (±20% randomization)
    if (strategy.jitterEnabled) {
      const jitter = delay * 0.2 * (Math.random() - 0.5);
      delay += jitter;
    }
    
    return Math.max(1, Math.round(delay)); // Minimum 1 minute
  }

  /**
   * Schedule retry for failed submission
   */
  private async scheduleRetry(
    context: ErrorContext,
    resolution: ErrorResolution
  ): Promise<void> {
    if (!resolution.retryStrategy || !context.applicationId) return;
    
    const attemptNumber = (context.attemptNumber || 0) + 1;
    const delayMinutes = this.calculateRetryDelay(attemptNumber, resolution.retryStrategy);
    const retryAt = addMinutes(new Date(), delayMinutes);
    
    // Update scheduled application for retry
    if (context.applicationId) {
      await db.automationScheduledApplication.update({
        where: { id: context.applicationId },
        data: {
          status: 'scheduled',
          scheduledFor: retryAt,
          attemptCount: attemptNumber,
          metadata: {
            ...context.metadata,
            lastError: context.lastError,
            retryReason: `${resolution.category} error - attempt ${attemptNumber}`,
            nextRetryDelay: delayMinutes,
          },
        },
      });
    }
    
    // Log retry scheduling
    await this.createAuditLog(context.userId, 'retry_scheduled', {
      applicationId: context.applicationId,
      attemptNumber,
      retryAt: retryAt.toISOString(),
      delayMinutes,
      errorCategory: resolution.category,
    });
  }

  /**
   * Add to manual intervention queue
   */
  private async addToManualInterventionQueue(
    context: ErrorContext,
    errorLog: ErrorLog
  ): Promise<void> {
    const queueId = `${context.userId}-${context.applicationId || context.jobLeadId}`;
    this.manualInterventionQueue.add(queueId);
    
    // Store in database for persistence
    await db.automationAuditLog.create({
      data: {
        userId: context.userId,
        action: 'manual_intervention_required',
        actionType: 'warning',
        metadata: {
          errorLog,
          context,
          queuedAt: new Date(),
        },
      },
    });
    
    // Update application status
    if (context.applicationId) {
      await db.automationScheduledApplication.update({
        where: { id: context.applicationId },
        data: {
          status: 'manual_review',
          metadata: {
            ...context.metadata,
            manualReviewReason: errorLog.message,
            requiresUserAction: true,
          },
        },
      });
    }
  }

  /**
   * Send error notification to user
   */
  private async sendErrorNotification(
    context: ErrorContext,
    errorLog: ErrorLog
  ): Promise<void> {
    const notificationData = {
      userId: context.userId,
      title: `Automation Error: ${errorLog.category}`,
      message: errorLog.message,
      type: 'automation_error',
      severity: errorLog.severity,
      link: context.applicationId ? `/tools/automation/errors/${context.applicationId}` : '/tools/automation',
      metadata: {
        errorId: errorLog.id,
        platform: context.platform,
        suggestedAction: errorLog.resolution.suggestedAction,
      },
    };
    
    await sendNotification(notificationData);
    
    // For critical errors, also create a persistent alert
    if (errorLog.severity === ErrorSeverity.CRITICAL) {
      await db.notification.create({
        data: {
          userId: context.userId,
          title: notificationData.title,
          message: notificationData.message,
          type: 'critical_error',
          link: notificationData.link,
          metadata: notificationData.metadata,
        },
      });
    }
  }

  /**
   * Attempt automatic error resolution
   */
  private async attemptAutoResolution(
    errorLog: ErrorLog,
    context: ErrorContext
  ): Promise<boolean> {
    const { category } = errorLog.resolution;
    
    switch (category) {
      case ErrorCategory.TEMPORARY:
        // Network errors often resolve themselves
        return true;
        
      case ErrorCategory.AUTHENTICATION:
        // Try refreshing authentication tokens
        return await this.refreshAuthentication(context);
        
      case ErrorCategory.PLATFORM:
        // Check if platform is temporarily down
        return await this.checkPlatformStatus(context.platform);
        
      case ErrorCategory.VALIDATION:
        // Attempt to fix common validation issues
        return await this.fixValidationErrors(context);
        
      default:
        return false;
    }
  }

  /**
   * Refresh authentication tokens
   */
  private async refreshAuthentication(context: ErrorContext): Promise<boolean> {
    try {
      // Platform-specific token refresh logic
      if (context.platform === 'linkedin') {
        // Refresh LinkedIn OAuth token
        // Implementation would go here
        return false;
      } else if (context.platform === 'indeed') {
        // Refresh Indeed session
        // Implementation would go here
        return false;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to refresh authentication:', error);
      return false;
    }
  }

  /**
   * Check platform status
   */
  private async checkPlatformStatus(platform?: string): Promise<boolean> {
    if (!platform) return false;
    
    // Check platform health endpoints
    const healthChecks: Record<string, string> = {
      linkedin: 'https://www.linkedin.com/api/health',
      indeed: 'https://www.indeed.com/api/status',
      glassdoor: 'https://www.glassdoor.com/api/health',
    };
    
    const endpoint = healthChecks[platform.toLowerCase()];
    if (!endpoint) return false;
    
    try {
      const response = await fetch(endpoint, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fix common validation errors
   */
  private async fixValidationErrors(context: ErrorContext): Promise<boolean> {
    if (!context.metadata?.validationErrors) return false;
    
    const fixableErrors = [
      'phone_format',
      'email_format',
      'date_format',
      'url_format',
    ];
    
    const errors = context.metadata.validationErrors as string[];
    const canAutoFix = errors.every(error => fixableErrors.includes(error));
    
    if (canAutoFix) {
      // Apply automatic fixes
      // Implementation would go here based on specific validation errors
      return true;
    }
    
    return false;
  }

  /**
   * Track consecutive failures for circuit breaker pattern
   */
  private trackConsecutiveFailures(userId: string, category: ErrorCategory): void {
    const key = `${userId}-${category}`;
    const current = this.consecutiveFailures.get(key) || 0;
    this.consecutiveFailures.set(key, current + 1);
    
    // Reset after successful submission (would be called elsewhere)
    // Or implement time-based reset
    setTimeout(() => {
      this.consecutiveFailures.delete(key);
    }, 60 * 60 * 1000); // Reset after 1 hour
  }

  /**
   * Check if circuit breaker should trip
   */
  async shouldTripCircuitBreaker(userId: string, category: ErrorCategory): Promise<boolean> {
    const key = `${userId}-${category}`;
    const failures = this.consecutiveFailures.get(key) || 0;
    
    // Get user's automation settings
    const settings = await db.automationSettings.findUnique({
      where: { userId },
    });
    
    const threshold = settings?.consecutiveFailureThreshold || 3;
    return failures >= threshold;
  }

  /**
   * Log error to database
   */
  private async logError(
    error: Error | unknown,
    categorization: { category: ErrorCategory; severity: ErrorSeverity },
    context: ErrorContext,
    resolution: ErrorResolution
  ): Promise<ErrorLog> {
    const errorLog: ErrorLog = {
      id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      category: categorization.category,
      severity: categorization.severity,
      message: this.extractErrorMessage(error),
      stackTrace: error instanceof Error ? error.stack : undefined,
      context,
      resolution,
      resolved: false,
    };
    
    // Store in memory cache
    const userLogs = this.errorLogs.get(context.userId) || [];
    userLogs.push(errorLog);
    this.errorLogs.set(context.userId, userLogs.slice(-100)); // Keep last 100 errors
    
    // Store in database
    await db.automationAuditLog.create({
      data: {
        userId: context.userId,
        action: 'automation_error',
        actionType: 'error',
        metadata: errorLog as any,
      },
    });
    
    return errorLog;
  }

  /**
   * Update application status based on error resolution
   */
  private async updateApplicationStatus(
    applicationId: string,
    resolution: ErrorResolution
  ): Promise<void> {
    let status: ApplicationStatus;
    
    if (resolution.category === ErrorCategory.PERMANENT) {
      status = ApplicationStatus.FAILED;
    } else if (resolution.isRetryable) {
      status = ApplicationStatus.PENDING;
    } else if (resolution.requiresUserAction) {
      status = ApplicationStatus.PENDING;
    } else {
      status = ApplicationStatus.FAILED;
    }
    
    await db.applicationSubmission.update({
      where: { id: applicationId },
      data: {
        status,
        errorMessage: resolution.suggestedAction,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(
    userId: string,
    action: string,
    metadata: any
  ): Promise<void> {
    await db.automationAuditLog.create({
      data: {
        userId,
        action,
        actionType: 'info',
        metadata,
      },
    });
  }

  /**
   * Extract error message from various error types
   */
  private extractErrorMessage(error: Error | unknown): string {
    if (error instanceof Error) {
      return error.message;
    } else if (typeof error === 'string') {
      return error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      return String((error as any).message);
    } else {
      return 'Unknown error occurred';
    }
  }

  /**
   * Check if error is auto-resolvable
   */
  private isAutoResolvable(category: ErrorCategory, context: ErrorContext): boolean {
    // Network errors often resolve themselves
    if (category === ErrorCategory.TEMPORARY) return true;
    
    // Auth errors might be resolvable with token refresh
    if (category === ErrorCategory.AUTHENTICATION && context.attemptNumber === 0) return true;
    
    // Some validation errors can be auto-fixed
    if (category === ErrorCategory.VALIDATION && context.metadata?.autoFixable) return true;
    
    return false;
  }

  /**
   * Get suggested action for error category
   */
  private getSuggestedAction(category: ErrorCategory, context: ErrorContext): string {
    switch (category) {
      case ErrorCategory.AUTHENTICATION:
        return 'Please check your login credentials and re-authenticate with the platform';
      case ErrorCategory.VALIDATION:
        return 'Review and correct the application form data';
      case ErrorCategory.PERMANENT:
        return 'This job may no longer be available or the position has been filled';
      case ErrorCategory.TEMPORARY:
        return 'Temporary issue detected, will retry automatically';
      case ErrorCategory.PLATFORM:
        return `Platform issue detected with ${context.platform || 'job board'}`;
      default:
        return 'Please review the error details and try again';
    }
  }

  /**
   * Get error statistics for user
   */
  async getErrorStatistics(userId: string): Promise<{
    totalErrors: number;
    errorsByCategory: Record<ErrorCategory, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    resolutionRate: number;
    averageResolutionTime: number;
  }> {
    const logs = this.errorLogs.get(userId) || [];
    
    const stats = {
      totalErrors: logs.length,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      resolutionRate: 0,
      averageResolutionTime: 0,
    };
    
    // Count by category and severity
    logs.forEach(log => {
      stats.errorsByCategory[log.category] = (stats.errorsByCategory[log.category] || 0) + 1;
      stats.errorsBySeverity[log.severity] = (stats.errorsBySeverity[log.severity] || 0) + 1;
    });
    
    // Calculate resolution rate
    const resolved = logs.filter(log => log.resolved).length;
    stats.resolutionRate = logs.length > 0 ? (resolved / logs.length) * 100 : 0;
    
    // Calculate average resolution time
    const resolutionTimes = logs
      .filter(log => log.resolved && log.resolvedAt)
      .map(log => differenceInMinutes(log.resolvedAt!, log.timestamp));
    
    if (resolutionTimes.length > 0) {
      stats.averageResolutionTime = resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length;
    }
    
    return stats;
  }

  /**
   * Get manual intervention queue
   */
  getManualInterventionQueue(userId: string): string[] {
    return Array.from(this.manualInterventionQueue)
      .filter(id => id.startsWith(userId));
  }

  /**
   * Resolve error manually
   */
  async resolveError(errorId: string, resolutionMethod: string): Promise<void> {
    // Find error in logs
    for (const [userId, logs] of this.errorLogs.entries()) {
      const log = logs.find(l => l.id === errorId);
      if (log) {
        log.resolved = true;
        log.resolvedAt = new Date();
        log.resolutionMethod = resolutionMethod;
        
        // Remove from manual intervention queue if present
        const queueId = `${userId}-${log.context.applicationId || log.context.jobLeadId}`;
        this.manualInterventionQueue.delete(queueId);
        
        // Update in database
        await this.createAuditLog(userId, 'error_resolved', {
          errorId,
          resolutionMethod,
          resolvedAt: log.resolvedAt,
        });
        
        break;
      }
    }
  }
}

// Singleton instance
export const automationErrorHandler = new AutomationErrorHandler();

// Utility function for partial submission recovery
export async function recoverPartialSubmission(
  applicationId: string,
  recoveryPoint: string,
  formData: Record<string, any>
): Promise<boolean> {
  try {
    // Store recovery data
    await db.applicationSubmission.update({
      where: { id: applicationId },
      data: {
        metadata: {
          recoveryPoint,
          partialData: formData,
          recoveryTimestamp: new Date(),
        },
      },
    });
    
    return true;
  } catch (error) {
    console.error('Failed to store recovery data:', error);
    return false;
  }
}