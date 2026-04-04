import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import AuditLog from '@/lib/models/AuditLog';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    await dbConnect();
    
    // Create audit log with all optional fields
    await (AuditLog as any).create({
      level: body.level || 'info',
      category: body.category || 'system',
      action: body.action || 'unknown',
      path: body.path || '/',
      url: body.url || body.path || '/',
      method: body.method || 'POST',
      ip: body.ip || 'unknown',
      userAgent: body.userAgent || 'unknown',
      userId: body.userId || null,
      userEmail: body.userEmail || null,
      statusCode: body.statusCode || 200,
      responseTime: body.responseTime || 0,
      metadata: body.metadata || {},
      error: body.error || null,
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Audit Log] Error creating log:', error);
    return NextResponse.json(
      { error: 'Failed to create audit log', details: (error as any).message },
      { status: 500 }
    );
  }
}
