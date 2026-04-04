import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import dbConnect from '@/lib/mongodb';
import PastWorkflow from '@/lib/models/PastWorkflow';
import User from '@/lib/models/User';
import mongoose from 'mongoose';

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid workflow ID' }, { status: 400 });
    }

    await dbConnect();
    const user = await User.findOne({ email: session.user.email });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const deleted = await PastWorkflow.findOneAndDelete({ _id: id, userId: user._id });
    if (!deleted) {
      return NextResponse.json({ error: 'Workflow not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Delete workflow error:', e);
    return NextResponse.json({ error: 'Failed to delete workflow' }, { status: 500 });
  }
}
