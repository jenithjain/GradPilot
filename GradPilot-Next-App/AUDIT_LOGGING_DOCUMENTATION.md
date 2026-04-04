# Audit Logging System Documentation

## Overview

A comprehensive audit logging system that tracks all API requests, user activities, errors, and performance metrics across the application. Deployed on Vercel with MongoDB storage and real-time dashboard.

## Features

### 🔍 Request Tracking
- **IP Address**: Captures client IP (works with Vercel's `x-forwarded-for` headers)
- **User Agent**: Browser/client information
- **Referer & Origin**: Request source tracking
- **Request Headers**: Full header capture
- **Query Parameters**: URL parameters logged
- **Request Body**: JSON body with sensitive field sanitization

### 📊 Performance Monitoring
- **Response Time**: Millisecond-level timing
- **Response Size**: Bytes transferred
- **Memory Usage**: Heap usage per request
- **Status Codes**: HTTP status tracking

### 🔐 Security & Privacy
- **Auto-Sanitization**: Passwords, tokens, secrets automatically redacted
- **User Tracking**: User ID and email (when authenticated)
- **Session IDs**: Session correlation
- **TTL**: Logs auto-delete after 90 days (configurable)

### 🎯 Categorization
- **Log Levels**: info, warn, error, critical
- **Categories**: api, auth, campaign, social, workflow, image, other
- **Actions**: Custom action tracking (e.g., "execute_workflow_node")

### 📈 Analytics Dashboard
- **Real-time Statistics**: Total requests, error rates, unique users
- **Category Breakdown**: Requests by category
- **Status Code Distribution**: HTTP status analytics
- **Top Endpoints**: Most requested APIs with avg response time
- **Recent Errors**: Last 10 errors with stack traces
- **Performance Metrics**: Average response times

## Architecture

### Components

1. **AuditLog Model** (`lib/models/AuditLog.js`)
   - MongoDB schema with indexes
   - TTL index for auto-cleanup
   - Optimized for time-series queries

2. **Audit Logger** (`lib/audit-logger.ts`)
   - Core logging functions
   - IP extraction (Vercel-compatible)
   - Request/response sanitization
   - Non-blocking async logging

3. **Middleware** (`proxy.js`)
   - Intercepts all requests
   - Adds tracking headers (`x-request-id`, `x-request-start-time`)
   - Console logging for Vercel logs
   - Integrated with existing authentication proxy

4. **API Routes**
   - `/api/audit/logs` - Query logs with filters
   - `/api/audit/stats` - Statistics and analytics

5. **Dashboard** (`app/audit/page.js`)
   - React UI with filters
   - Real-time updates (30s interval)
   - Pagination and search

## Usage

### Accessing the Dashboard

Navigate to: **`https://your-app.vercel.app/audit`**

**Note**: This page requires authentication. Only logged-in users can access audit logs.

### API Endpoints

#### Get Logs
```http
GET /api/audit/logs?page=1&limit=50&level=error&category=campaign&search=keyword
```

**Query Parameters**:
- `page` - Page number (default: 1)
- `limit` - Logs per page (default: 50)
- `level` - Filter by level: info, warn, error, critical
- `category` - Filter by category: api, auth, campaign, social, workflow, image
- `userId` - Filter by user ID
- `ip` - Filter by IP address
- `startDate` - ISO date (e.g., 2025-11-23T00:00:00Z)
- `endDate` - ISO date
- `search` - Text search across URL, path, user email, error messages

**Response**:
```json
{
  "success": true,
  "logs": [
    {
      "_id": "...",
      "timestamp": "2025-11-23T10:30:00Z",
      "method": "POST",
      "path": "/api/campaign/execute-node",
      "statusCode": 200,
      "responseTime": 1234,
      "ip": "192.168.1.1",
      "userEmail": "user@example.com",
      "level": "info",
      "category": "campaign",
      "error": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1523,
    "pages": 31
  }
}
```

#### Get Statistics
```http
GET /api/audit/stats
```

**Response**:
```json
{
  "success": true,
  "stats": {
    "total": {
      "logs": 15234,
      "last24h": 1234,
      "last7d": 8765
    },
    "errors": {
      "last24h": 12,
      "rate": "0.97"
    },
    "users": {
      "unique24h": 45
    },
    "traffic": {
      "uniqueIPs24h": 67
    },
    "performance": {
      "avgResponseTime": "234.56"
    },
    "breakdowns": {
      "byCategory": [...],
      "byStatusCode": [...],
      "topEndpoints": [...]
    },
    "recentErrors": [...]
  }
}
```

### Programmatic Logging

#### Automatic Logging (Recommended)
All API routes are automatically logged via middleware. No code changes needed.

#### Manual Logging
For custom events or additional context:

```typescript
import { logAuditEvent } from '@/lib/audit-logger';

export async function POST(request: Request) {
  const startTime = Date.now();
  let response: Response | null = null;
  let error: Error | null = null;

  try {
    // Your API logic
    response = NextResponse.json({ success: true });
    return response;
  } catch (err) {
    error = err as Error;
    response = NextResponse.json({ error: 'Failed' }, { status: 500 });
    return response;
  } finally {
    // Log audit event (non-blocking)
    await logAuditEvent({
      request,
      response: response || undefined,
      session: await getServerSession(authOptions),
      error,
      action: 'custom_action_name',
      metadata: { customField: 'value' },
      startTime,
    });
  }
}
```

#### Wrapper Function
```typescript
import { withAuditLog } from '@/lib/audit-logger';

export const POST = withAuditLog(
  async (req, res) => {
    // Your handler logic
    return NextResponse.json({ success: true });
  },
  { action: 'custom_action', metadata: {} }
);
```

## Database Schema

```javascript
{
  // Request Info
  timestamp: Date,
  method: String, // GET, POST, etc.
  url: String,
  path: String,
  
  // User Info
  userId: ObjectId,
  userEmail: String,
  sessionId: String,
  
  // Network Info
  ip: String,
  userAgent: String,
  referer: String,
  origin: String,
  
  // Request Details
  requestHeaders: Object,
  requestBody: Object, // Sanitized
  queryParams: Object,
  
  // Response Details
  statusCode: Number,
  responseTime: Number, // milliseconds
  responseSize: Number, // bytes
  
  // Error Info
  error: {
    message: String,
    stack: String,
    code: String
  },
  
  // Context
  level: String, // info, warn, error, critical
  category: String, // api, auth, campaign, social, workflow, image, other
  action: String,
  metadata: Object,
  
  // Geolocation (optional)
  country: String,
  city: String,
  
  // Performance
  memoryUsage: Number,
  cpuUsage: Number
}
```

## Indexes

For optimal query performance:
```javascript
// Time-based queries
{ timestamp: -1 }

// User activity
{ userId: 1, timestamp: -1 }

// Error tracking
{ level: 1, timestamp: -1 }

// Category filtering
{ category: 1, timestamp: -1 }

// IP tracking
{ ip: 1, timestamp: -1 }

// Status codes
{ statusCode: 1, timestamp: -1 }

// TTL for auto-deletion (90 days)
{ timestamp: 1 }, { expireAfterSeconds: 7776000 }
```

## Configuration

### Environment Variables
No additional environment variables needed. Uses existing `MONGODB_URI`.

### TTL (Time To Live)
Logs auto-delete after 90 days. To change:

Edit `lib/models/AuditLog.js`:
```javascript
AuditLogSchema.index(
  { timestamp: 1 }, 
  { expireAfterSeconds: 7776000 } // 90 days in seconds
);
```

### Sensitive Field Sanitization
To add more fields to auto-redact:

Edit `lib/audit-logger.ts`:
```typescript
const sensitiveFields = [
  'password', 
  'token', 
  'secret', 
  'apiKey', 
  'accessToken',
  // Add more here
];
```

## Security Considerations

### Access Control
- ✅ Dashboard requires authentication
- ✅ API routes check session
- ⚠️ Add role-based access control for admin-only access

### Data Privacy
- ✅ Sensitive fields auto-redacted
- ✅ TTL prevents indefinite storage
- ✅ User consent should be obtained (GDPR/CCPA compliance)

### Performance
- ✅ Non-blocking async logging (doesn't slow requests)
- ✅ Efficient MongoDB indexes
- ✅ Failed logs don't break app

## Monitoring on Vercel

### Real-time Logs
View in Vercel Dashboard:
1. Go to your project
2. Click "Deployments"
3. Select latest deployment
4. Go to "Functions" tab
5. Click on any function to see logs

### Log Patterns to Watch
```
[MIDDLEWARE] { timestamp, method, path, ip, userAgent }
[AUDIT] { timestamp, method, path, statusCode, responseTime, ip, userId, level, error }
[Cloudinary] Configuration loaded: { hasCloudName, hasApiKey, hasApiSecret }
[execute-node] Starting image generation for node: xxx
```

### Alerts (Recommended)
Set up alerts in Vercel for:
- High error rates (> 5% in 5 minutes)
- Slow response times (> 5 seconds p95)
- Memory issues (> 512MB)

## Troubleshooting

### Logs Not Appearing in Dashboard
1. Check MongoDB connection: `MONGODB_URI` set correctly?
2. Check authentication: Are you logged in?
3. Check browser console for errors
4. Check Vercel function logs for database errors

### High Database Storage
- Verify TTL index is created: `db.audit_logs.getIndexes()`
- Manually delete old logs: `db.audit_logs.deleteMany({ timestamp: { $lt: new Date('2025-01-01') } })`

### Slow Queries
- Ensure indexes are created (check schema)
- Add compound indexes if needed
- Consider archiving old logs to separate collection

## Best Practices

### 1. Regular Monitoring
- Review error trends weekly
- Check top failing endpoints
- Monitor response time trends

### 2. Incident Response
- Use search to find related errors
- Filter by IP to track malicious activity
- Export logs for detailed analysis

### 3. Performance Optimization
- Keep log retention reasonable (30-90 days)
- Archive critical logs separately
- Use aggregation for analytics

### 4. Security Audits
- Review failed authentication attempts
- Monitor unusual IP patterns
- Track API abuse (rate limiting)

## Example Queries

### Find All Errors for a User
```javascript
db.audit_logs.find({
  userEmail: "user@example.com",
  level: { $in: ["error", "critical"] }
}).sort({ timestamp: -1 })
```

### Top Slowest Endpoints
```javascript
db.audit_logs.aggregate([
  { $match: { responseTime: { $exists: true } } },
  { $group: { 
    _id: "$path", 
    avgTime: { $avg: "$responseTime" },
    count: { $sum: 1 }
  }},
  { $sort: { avgTime: -1 } },
  { $limit: 10 }
])
```

### Failed Requests by IP
```javascript
db.audit_logs.aggregate([
  { $match: { statusCode: { $gte: 400 } } },
  { $group: { _id: "$ip", count: { $sum: 1 } }},
  { $sort: { count: -1 } }
])
```

## Future Enhancements

- [ ] Geolocation enrichment (IP → Country/City)
- [ ] Email alerts for critical errors
- [ ] Slack/Discord notifications
- [ ] Export logs to CSV/JSON
- [ ] Log retention policies per category
- [ ] Advanced analytics (ML-based anomaly detection)
- [ ] Performance budgeting and alerts
- [ ] Custom dashboards per user role

## Support

For issues or questions:
1. Check Vercel function logs
2. Check MongoDB connection
3. Review this documentation
4. Check browser console for frontend errors

## License

Part of GradPilot application.
