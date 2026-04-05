import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import bcrypt from 'bcryptjs';

// POST /api/seed-counsellors — Run once to seed the two counsellor accounts
export async function POST() {
  try {
    await dbConnect();

    const hashedPassword = await bcrypt.hash('Con@123', 10);

    const counsellors = [
      {
        email: 'counseller@gmail.com',
        password: hashedPassword,
        name: 'Counsellor Admin',
        role: 'counsellor',
        authProvider: 'credentials',
        hasCompletedKYC: true,
      },
      {
        email: 'jenithjain09@gmail.com',
        name: 'Jenith Jain',
        role: 'counsellor',
        authProvider: 'google',
        hasCompletedKYC: true,
      },
    ];

    const results = [];
    for (const c of counsellors) {
      const res = await User.updateOne(
        { email: c.email },
        { $set: c },
        { upsert: true }
      );
      results.push({ email: c.email, ...res });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('[seed-counsellors] error:', error);
    return NextResponse.json({ error: 'Failed to seed counsellors' }, { status: 500 });
  }
}
