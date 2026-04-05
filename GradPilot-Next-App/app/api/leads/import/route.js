import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';

/**
 * POST /api/leads/import
 * Bulk-import leads from campaign CSV / voice session data into the Kanban pipeline
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'counsellor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const body = await request.json();
    const { leads } = body;

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'No leads provided' }, { status: 400 });
    }

    const validStatuses = ['new', 'in_progress', 'follow_up', 'completed'];
    const created = [];
    const skipped = [];

    for (const lead of leads) {
      if (!lead.name || typeof lead.name !== 'string') {
        skipped.push({ reason: 'Missing name', lead });
        continue;
      }

      // Skip duplicates by name + email combo
      const query = { name: lead.name.trim() };
      if (lead.email) query.email = lead.email.trim();
      const existing = await Lead.findOne(query).lean();
      if (existing) {
        skipped.push({ reason: 'Duplicate', lead });
        continue;
      }

      const doc = await Lead.create({
        name: lead.name.trim(),
        email: lead.email || '',
        phone: lead.phone || '',
        sourceType: lead.sourceType || '',
        sourceUrl: lead.sourceUrl || '',
        location: lead.location || '',
        course: lead.course || '',
        country: lead.country || '',
        exam: lead.exam || '',
        examDetail: lead.examDetail || '',
        score: typeof lead.score === 'number' ? Math.min(100, Math.max(0, lead.score)) : 0,
        status: validStatuses.includes(lead.status) ? lead.status : 'new',
        avatar: lead.avatar || '',
        notes: lead.notes || '',
        tags: Array.isArray(lead.tags) ? lead.tags : [],
        counsellorId: session.user.id,
      });

      created.push({
        id: String(doc._id),
        name: doc.name,
      });
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      skipped: skipped.length,
      details: { created, skipped },
    });
  } catch (error) {
    console.error('[leads/import] POST error:', error);
    return NextResponse.json({ error: 'Failed to import leads' }, { status: 500 });
  }
}
