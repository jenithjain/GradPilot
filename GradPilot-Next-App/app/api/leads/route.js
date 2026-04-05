import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const leads = await Lead.find({}).sort({ createdAt: -1 }).lean();

    const serialized = leads.map((l) => ({
      id: String(l._id),
      name: l.name,
      email: l.email || '',
      phone: l.phone || '',
      sourceType: l.sourceType || '',
      sourceUrl: l.sourceUrl || '',
      location: l.location,
      course: l.course,
      country: l.country,
      exam: l.exam,
      examDetail: l.examDetail || '',
      score: l.score,
      status: l.status,
      avatar: l.avatar,
      notes: l.notes,
      tags: l.tags || [],
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error('[leads] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'counsellor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const body = await request.json();
    const { name, location, course, country, exam, examDetail, score, status, avatar, notes, tags } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const validStatuses = ['new', 'in_progress', 'follow_up', 'completed'];
    const leadStatus = validStatuses.includes(status) ? status : 'new';

    const doc = await Lead.create({
      name,
      location: location || '',
      course: course || '',
      country: country || '',
      exam: exam || '',
      examDetail: examDetail || '',
      score: typeof score === 'number' ? score : 0,
      status: leadStatus,
      avatar: avatar || '',
      notes: notes || '',
      tags: Array.isArray(tags) ? tags : [],
      counsellorId: session.user.id,
    });

    return NextResponse.json({
      id: String(doc._id),
      name: doc.name,
      location: doc.location,
      course: doc.course,
      country: doc.country,
      exam: doc.exam,
      examDetail: doc.examDetail,
      score: doc.score,
      status: doc.status,
      avatar: doc.avatar,
      notes: doc.notes,
      tags: doc.tags,
    }, { status: 201 });
  } catch (error) {
    console.error('[leads] POST error:', error);
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'counsellor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Lead id is required' }, { status: 400 });
    }

    if (updates.status) {
      const validStatuses = ['new', 'in_progress', 'follow_up', 'completed'];
      if (!validStatuses.includes(updates.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
    }

    const doc = await Lead.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!doc) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: String(doc._id),
      name: doc.name,
      location: doc.location,
      course: doc.course,
      country: doc.country,
      exam: doc.exam,
      examDetail: doc.examDetail,
      score: doc.score,
      status: doc.status,
      avatar: doc.avatar,
      notes: doc.notes,
      tags: doc.tags,
    });
  } catch (error) {
    console.error('[leads] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
  }
}

/**
 * DELETE /api/leads
 * Delete a single lead by id (?id=xxx) or all leads (?all=true)
 */
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'counsellor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const all = searchParams.get('all');

    if (all === 'true') {
      const result = await Lead.deleteMany({ counsellorId: session.user.id });
      return NextResponse.json({ success: true, deleted: result.deletedCount });
    }

    if (!id) {
      return NextResponse.json({ error: 'Lead id or all=true is required' }, { status: 400 });
    }

    const doc = await Lead.findOneAndDelete({ _id: id, counsellorId: session.user.id });
    if (!doc) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted: 1 });
  } catch (error) {
    console.error('[leads] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 });
  }
}
