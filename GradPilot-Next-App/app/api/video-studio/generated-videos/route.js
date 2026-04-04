import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import dbConnect from '@/lib/mongodb';
import GeneratedVideo from '@/lib/models/GeneratedVideo';
import { readdir } from 'fs/promises';
import path from 'path';

/**
 * GET /api/video-studio/generated-videos
 * Fetches user's generated videos by workflowId and optional agentType.
 * Returns map keyed by agentType then promptKey.
 * Includes orphan recovery by scanning public/generated-videos.
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflowId');
    const agentType = searchParams.get('agentType');

    if (!workflowId) {
      return NextResponse.json(
        { error: 'workflowId is required' },
        { status: 400 }
      );
    }

    await dbConnect();

    const query = {
      workflowId,
      userId: session.user.id,
      status: 'completed',
    };

    if (agentType) {
      query.agentType = agentType;
    }

    const videos = await GeneratedVideo.find(query)
      .sort({ generatedAt: -1 })
      .lean();

    // Build map: { agentType: { promptKey: videoUrl } }
    const videoMap = {};
    for (const video of videos) {
      const type = video.agentType || 'cinematic-teaser';
      if (!videoMap[type]) {
        videoMap[type] = {};
      }
      videoMap[type][video.promptKey || `prompt_${video.promptIndex || 0}`] = video.localPath;
    }

    // Orphan recovery: scan public/generated-videos for recent files
    // that may have been saved to disk but not to the DB
    try {
      const videosDir = path.join(process.cwd(), 'public', 'generated-videos');
      const files = await readdir(videosDir);
      const recentCutoff = Date.now() - (24 * 60 * 60 * 1000); // 24h

      for (const file of files) {
        if (!file.endsWith('.mp4')) continue;

        // Extract timestamp from filename (format: project_scene_index_timestamp.mp4)
        const parts = file.replace('.mp4', '').split('_');
        const fileTimestamp = parseInt(parts[parts.length - 1]);

        if (isNaN(fileTimestamp) || fileTimestamp < recentCutoff) continue;

        // Check if this file is already tracked
        const isTracked = videos.some(v => v.fileName === file);
        if (!isTracked) {
          const orphanType = 'cinematic-teaser';
          if (!videoMap[orphanType]) {
            videoMap[orphanType] = {};
          }
          const orphanKey = `orphan_${file.replace('.mp4', '')}`;
          if (!videoMap[orphanType][orphanKey]) {
            videoMap[orphanType][orphanKey] = `/generated-videos/${file}`;
          }
        }
      }
    } catch {
      // Directory may not exist yet
    }

    return NextResponse.json({
      success: true,
      videos: videoMap,
      count: videos.length,
    });

  } catch (error) {
    console.error('Error fetching generated videos:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch videos',
    }, { status: 500 });
  }
}
