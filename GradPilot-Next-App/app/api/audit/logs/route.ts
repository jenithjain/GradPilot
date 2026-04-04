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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const level = searchParams.get('level');
    const category = searchParams.get('category');
    const userId = searchParams.get('userId');
    const ip = searchParams.get('ip');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    await dbConnect();

    // Build query
    const query: Record<string, any> = {};

    if (level) query.level = level;
    if (category) query.category = category;
    if (userId) query.userId = userId;
    if (ip) query.ip = ip;
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { url: { $regex: search, $options: 'i' } },
        { path: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } },
        { 'error.message': { $regex: search, $options: 'i' } },
      ];
    }

    // Get total count
    const total = await (AuditLog as any).countDocuments(query);

    // Get paginated logs
    const logs = await (AuditLog as any)
      .find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'email name')
      .lean()
      .exec();

    return NextResponse.json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[AuditLog API] Error fetching logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
