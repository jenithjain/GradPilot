import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import dbConnect from '@/lib/mongodb';
import AuditLog from '@/lib/models/AuditLog';

export async function GET(request: Request) {
  try {
    // Check authentication
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Get statistics
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const AuditLogModel = AuditLog as any;

    const [
      totalLogs,
      logs24h,
      logs7d,
      errorCount24h,
      uniqueUsers24h,
      uniqueIPs24h,
      categoryBreakdown,
      statusCodeBreakdown,
      topEndpoints,
      recentErrors,
      avgResponseTime,
    ] = await Promise.all([
      // Total logs
      AuditLogModel.countDocuments(),
      
      // Last 24h
      AuditLogModel.countDocuments({ timestamp: { $gte: last24h } }),
      
      // Last 7d
      AuditLogModel.countDocuments({ timestamp: { $gte: last7d } }),
      
      // Errors in last 24h
      AuditLogModel.countDocuments({
        timestamp: { $gte: last24h },
        level: { $in: ['error', 'critical'] },
      }),
      
      // Unique users in last 24h
      AuditLogModel.distinct('userId', { timestamp: { $gte: last24h } }).then((arr: any) => arr.length),
      
      // Unique IPs in last 24h
      AuditLogModel.distinct('ip', { timestamp: { $gte: last24h } }).then((arr: any) => arr.length),
      
      // Category breakdown
      AuditLogModel.aggregate([
        { $match: { timestamp: { $gte: last24h } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      
      // Status code breakdown
      AuditLogModel.aggregate([
        { $match: { timestamp: { $gte: last24h } } },
        { $group: { _id: '$statusCode', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      
      // Top endpoints
      AuditLogModel.aggregate([
        { $match: { timestamp: { $gte: last24h } } },
        { $group: { _id: '$path', count: { $sum: 1 }, avgResponseTime: { $avg: '$responseTime' } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      
      // Recent errors
      AuditLogModel.find({
        level: { $in: ['error', 'critical'] },
      })
        .sort({ timestamp: -1 })
        .limit(10)
        .select('timestamp path statusCode error.message ip userEmail')
        .lean(),
      
      // Average response time
      AuditLogModel.aggregate([
        { $match: { timestamp: { $gte: last24h }, responseTime: { $exists: true } } },
        { $group: { _id: null, avgResponseTime: { $avg: '$responseTime' } } },
      ]),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        total: {
          logs: totalLogs,
          last24h: logs24h,
          last7d: logs7d,
        },
        errors: {
          last24h: errorCount24h,
          rate: logs24h > 0 ? ((errorCount24h / logs24h) * 100).toFixed(2) : 0,
        },
        users: {
          unique24h: uniqueUsers24h,
        },
        traffic: {
          uniqueIPs24h: uniqueIPs24h,
        },
        performance: {
          avgResponseTime: avgResponseTime[0]?.avgResponseTime?.toFixed(2) || 0,
        },
        breakdowns: {
          byCategory: categoryBreakdown,
          byStatusCode: statusCodeBreakdown,
          topEndpoints: topEndpoints,
        },
        recentErrors: recentErrors,
      },
    });
  } catch (error) {
    console.error('[AuditLog Stats] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
