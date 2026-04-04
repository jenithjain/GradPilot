import { NextRequest } from 'next/server';
import dbConnect from './mongodb';
import AuditLog from './models/AuditLog';

/**
 * Extract client IP from request headers
 * Works with Vercel's forwarded headers
 */
export function getClientIP(request: NextRequest): string {
  // Try Vercel-specific headers first
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  // Fallback headers
  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP;

  const cfConnectingIP = request.headers.get('cf-connecting-ip'); // Cloudflare
  if (cfConnectingIP) return cfConnectingIP;

  return 'unknown';
}

/**
 * Get user info from session or request
 */
export function extractUserInfo(session: any) {
  if (!session?.user) {
    return { userId: null, userEmail: null };
  }
  return {
    userId: session.user.id || null,
    userEmail: session.user.email || null,
  };
}

/**
 * Sanitize sensitive data from request body
 */
export function sanitizeRequestBody(body: any): any {
  if (!body) return null;
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'accessToken'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

/**
 * Determine log category from URL path
 */
export function getCategoryFromPath(path: string): string {
  if (path.includes('/api/auth')) return 'auth';
  if (path.includes('/api/campaign')) return 'campaign';
  if (path.includes('/api/linkedin') || path.includes('/api/twitter')) return 'social';
  if (path.includes('/api/workflows')) return 'workflow';
  if (path.includes('/api/cloudinary') || path.includes('image')) return 'image';
  return 'api';
}

/**
 * Determine log level from status code
 */
export function getLevelFromStatus(statusCode: number): string {
  if (statusCode >= 500) return 'critical';
  if (statusCode >= 400) return 'error';
  if (statusCode >= 300) return 'warn';
  return 'info';
}

/**
 * Main audit logging function
 */
export async function logAuditEvent({
  request,
  response,
  session = null,
  error = null,
  action = null,
  metadata = {},
  startTime = Date.now(),
}: {
  request: NextRequest | Request;
  response?: Response;
  session?: any;
  error?: Error | null;
  action?: string | null;
  metadata?: any;
  startTime?: number;
}) {
  try {
    await dbConnect();

    const url = request.url;
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    
    // Extract user info
    const userInfo = extractUserInfo(session);
    
    // Get client IP
    const ip = 'headers' in request ? getClientIP(request as NextRequest) : 'unknown';
    
    // Parse request body if available
    let requestBody = null;
    if (request.method !== 'GET' && 'json' in request) {
      try {
        const clonedRequest = request.clone();
        requestBody = await clonedRequest.json();
        requestBody = sanitizeRequestBody(requestBody);
      } catch (e) {
        // Body not JSON or already consumed
      }
    }
    
    // Calculate response time
    const responseTime = Date.now() - startTime;
    
    // Determine status code
    const statusCode = response?.status || (error ? 500 : 200);
    
    // Create log entry
    const logEntry = {
      timestamp: new Date(),
      method: request.method,
      url: url,
      path: path,
      
      // User info
      userId: userInfo.userId,
      userEmail: userInfo.userEmail,
      sessionId: session?.user?.id || null,
      
      // Network info
      ip: ip,
      userAgent: request.headers.get('user-agent') || 'unknown',
      referer: request.headers.get('referer') || null,
      origin: request.headers.get('origin') || null,
      
      // Request details
      requestHeaders: Object.fromEntries(request.headers.entries()),
      requestBody: requestBody,
      queryParams: Object.fromEntries(urlObj.searchParams.entries()),
      
      // Response details
      statusCode: statusCode,
      responseTime: responseTime,
      responseSize: response?.headers.get('content-length') 
        ? parseInt(response.headers.get('content-length')!) 
        : null,
      
      // Error info
      error: error ? {
        message: error.message,
        stack: error.stack,
        code: (error as any).code || null,
      } : null,
      
      // Context
      level: getLevelFromStatus(statusCode),
      category: getCategoryFromPath(path),
      action: action,
      metadata: metadata,
      
      // Performance (if available)
      memoryUsage: process.memoryUsage?.().heapUsed || null,
    };

    // Save to database (non-blocking)
    AuditLog.create(logEntry).catch(err => {
      console.error('[AuditLog] Failed to save log:', err);
    });

    // Also log to console for Vercel logs
    console.log('[AUDIT]', {
      timestamp: logEntry.timestamp.toISOString(),
      method: logEntry.method,
      path: logEntry.path,
      statusCode: logEntry.statusCode,
      responseTime: `${logEntry.responseTime}ms`,
      ip: logEntry.ip,
      userId: logEntry.userId,
      level: logEntry.level,
      error: error?.message || null,
    });

  } catch (err) {
    // Don't let logging errors break the application
    console.error('[AuditLog] Failed to create audit log:', err);
  }
}

/**
 * Middleware wrapper for API routes
 */
export function withAuditLog(
  handler: (req: any, res: any) => Promise<any>,
  options: { action?: string; metadata?: any } = {}
) {
  return async (req: any, res: any) => {
    const startTime = Date.now();
    let error: Error | null = null;
    let response: any = null;

    try {
      response = await handler(req, res);
      return response;
    } catch (err) {
      error = err as Error;
      throw err;
    } finally {
      // Log after response
      logAuditEvent({
        request: req,
        response: response,
        error: error,
        action: options.action,
        metadata: options.metadata,
        startTime: startTime,
      }).catch(() => {}); // Silently fail
    }
  };
}

/**
 * Express-style middleware
 */
export async function auditMiddleware(req: any, res: any, next: any) {
  const startTime = Date.now();
  
  // Capture the original end method
  const originalEnd = res.end;
  
  res.end = function(...args: any[]) {
    logAuditEvent({
      request: req,
      response: res,
      startTime: startTime,
    }).catch(() => {});
    
    originalEnd.apply(res, args);
  };
  
  next();
}
