import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import dbConnect from '@/lib/mongodb';
import GeneratedVideo from '@/lib/models/GeneratedVideo';
import ScriptWorkflow from '@/lib/models/ScriptWorkflow';

// In-memory store for video operations (use Redis in production)
const videoOperations = new Map();

// Rate limiting: track last video generation per user
const userLastGeneration = new Map();
const MIN_SECONDS_BETWEEN_VIDEOS = 30;

// Memory cleanup constants
const OPERATION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanupTime = 0;

function cleanupExpiredOperations() {
  const now = Date.now();
  if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) return;
  lastCleanupTime = now;

  let cleanedCount = 0;
  for (const [key, value] of videoOperations.entries()) {
    if (value.timestamp && (now - value.timestamp) > OPERATION_TTL_MS) {
      videoOperations.delete(key);
      cleanedCount++;
    }
  }

  const dayAgo = now - (24 * 60 * 60 * 1000);
  for (const [key, value] of userLastGeneration.entries()) {
    if (value < dayAgo) {
      userLastGeneration.delete(key);
    }
  }

  if (cleanedCount > 0) {
    console.log(`[VideoOps] Cleaned up ${cleanedCount} expired operations`);
  }
}

function generateVideoFileName(options = {}) {
  const {
    projectName = 'draft',
    sceneName = 'scene',
    promptIndex = 0,
    timestamp = Date.now()
  } = options;

  const cleanProject = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .substring(0, 30);

  const cleanScene = sceneName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .substring(0, 30);

  return `${cleanProject}_${cleanScene}_${promptIndex}_${timestamp}.mp4`;
}

/**
 * POST: Start video generation using Google Veo models
 */
export async function POST(request) {
  cleanupExpiredOperations();

  let requestData = {};

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const lastGen = userLastGeneration.get(userId);
    const now = Date.now();

    if (lastGen) {
      const secondsSinceLastGen = (now - lastGen) / 1000;
      if (secondsSinceLastGen < MIN_SECONDS_BETWEEN_VIDEOS) {
        const waitTime = Math.ceil(MIN_SECONDS_BETWEEN_VIDEOS - secondsSinceLastGen);
        return NextResponse.json({
          success: false,
          error: `Please wait ${waitTime} seconds before generating another video.`,
          status: 'rate_limited',
          retryAfter: waitTime,
        }, { status: 429 });
      }
    }

    requestData = await request.json();

    const {
      prompt,
      aspectRatio = '16:9',
      resolution = '720p',
      duration = 10,
      negativePrompt = '',
      allowSilentFallback = false,
      workflowId,
      agentType = 'cinematic-teaser',
      agentId,
      promptIndex = 0,
      promptKey,
      sceneName,
      sceneDetails,
      projectName,
      draftName
    } = requestData;

    if (!prompt) {
      return NextResponse.json(
        { error: 'Video prompt is required' },
        { status: 400 }
      );
    }

    const requestedDuration = parseInt(duration) || 10;
    const validDuration = Math.min(10, Math.max(4, requestedDuration));

    const promptEnhancer = [
      'Create a polished education advertisement video clip.',
      'Support person-led storytelling, natural speaking moments, and short on-screen CTA text where requested.',
      'Keep visuals professional, family-safe, and realistic with smooth cinematic motion.'
    ].join(' ');
    const finalPrompt = `${promptEnhancer}\n${String(prompt).trim()}`;

    const defaultNegativePrompt = [
      'low quality',
      'blurry',
      'pixelated',
      'shaky camera',
      'jitter',
      'chaotic composition',
      'meme style',
      'amateur look',
      'distorted faces',
      'artifacts',
      'oversaturated colors',
      'watermark',
      'collage',
      'split screen',
      'third-party logos'
    ].join(', ');

    const effectiveNegativePrompt = String(negativePrompt || '').trim() || defaultNegativePrompt;

    console.log('🎬 Starting Veo video generation...');
    console.log('Prompt:', finalPrompt.substring(0, 120) + '...');
    console.log('Config:', { aspectRatio, resolution, duration: validDuration });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'No Gemini API key configured. Please add GEMINI_API_KEY to your environment.' },
        { status: 400 }
      );
    }

    const { GoogleGenAI } = await import('@google/genai');
    const client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const configParams = {
      aspect_ratio: aspectRatio,
      resolution: resolution,
    };

    if (resolution === '720p') {
      configParams.duration_seconds = validDuration;
    } else if (resolution === '1080p' || resolution === '4k') {
      configParams.duration_seconds = Math.min(8, validDuration);
    }

    configParams.negative_prompt = effectiveNegativePrompt;

    console.log('📤 Sending request to Veo API...');

    const veoModels = [
      'veo-3.0-generate-001',
      'veo-3.0-fast-generate-001',
      'veo-3.1-generate-preview',
      'veo-2.0-generate-001',
    ];

    let operation = null;
    let lastError = null;
    let usedModel = null;

    for (const model of veoModels) {
      try {
        console.log(`🎬 Trying model: ${model}`);
        operation = await client.models.generateVideos({
          model: model,
          prompt: finalPrompt,
          config: configParams,
        });
        usedModel = model;
        console.log(`✅ Success with model: ${model}`);
        break;
      } catch (modelError) {
        console.log(`❌ Model ${model} failed:`, modelError.message);
        lastError = modelError;
        if (modelError.message?.includes('quota') || modelError.message?.includes('429')) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        continue;
      }
    }

    if (!operation) {
      throw lastError || new Error('All Veo models failed');
    }

    const operationId = operation.name || `veo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('📋 Operation response:', JSON.stringify(operation, null, 2));

    videoOperations.set(operationId, {
      operation,
      prompt: finalPrompt,
      config: configParams,
      status: 'processing',
      startedAt: new Date().toISOString(),
      timestamp: Date.now(),
      client,
      userId: session.user.id,
      workflowId,
      agentType,
      agentId,
      promptIndex,
      promptKey: promptKey || `prompt_${promptIndex}`,
      sceneName,
      sceneDetails,
      projectName,
      draftName,
      allowSilentFallback: Boolean(allowSilentFallback)
    });

    userLastGeneration.set(userId, Date.now());

    console.log('✅ Video generation started, operation:', operationId);

    return NextResponse.json({
      success: true,
      message: 'Video generation started',
      operationId: operationId,
      status: 'processing',
      config: {
        prompt: prompt.substring(0, 100) + '...',
        aspectRatio,
        resolution,
        duration: `${configParams.duration_seconds || validDuration}s`,
      },
      estimatedTime: '30s - 2min for short clips',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Video Generation Error:', error);

    if (error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json({
        success: false,
        error: 'API quota exceeded. Try again later.',
        status: 'quota_exceeded',
        shouldPoll: false,
        concept: {
          prompt: requestData.prompt || 'Unknown prompt',
          canRetryIn: '1 hour'
        }
      }, { status: 429 });
    }

    if (error.message?.includes('rate') || error.message?.includes('too many')) {
      return NextResponse.json({
        success: false,
        error: 'Rate limit hit. Please wait before generating another video.',
        status: 'rate_limited',
        shouldPoll: false,
        retryAfter: 60,
      }, { status: 429 });
    }

    if (error.message?.includes('permission') || error.message?.includes('403')) {
      return NextResponse.json({
        success: false,
        error: 'Veo API access denied. Ensure the API is enabled in your GCP project.',
        status: 'permission_denied',
        shouldPoll: false,
      }, { status: 403 });
    }

    return NextResponse.json({
      success: false,
      message: 'Video generation unavailable - concept mode',
      status: 'concept_only',
      shouldPoll: false,
      error: error.message,
      concept: {
        prompt: requestData.prompt || 'Unknown prompt',
        tip: 'Copy this prompt to Google AI Studio to generate the video manually',
      },
      fallbackUrl: 'https://aistudio.google.com',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * GET: Poll video generation status or retrieve completed video
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const operationId = searchParams.get('operationId');

    if (!operationId) {
      return NextResponse.json(
        { error: 'Operation ID is required' },
        { status: 400 }
      );
    }

    const storedOp = videoOperations.get(operationId);

    if (!storedOp) {
      return NextResponse.json({
        success: false,
        status: 'not_found',
        error: 'Operation not found or expired. Please try generating again.'
      }, { status: 404 });
    }

    if (storedOp.status === 'completed' && storedOp.videoUrl) {
      return NextResponse.json({
        success: true,
        status: 'completed',
        videoUrl: storedOp.videoUrl,
        message: 'Video ready'
      });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'No Gemini API key configured.' }, { status: 400 });
    }

    console.log('🔄 Polling operation status...');

    const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${operationId}?key=${GEMINI_API_KEY}`;
    const pollResponse = await fetch(pollUrl);

    if (!pollResponse.ok) {
      const errorText = await pollResponse.text();
      console.error('Poll API Error:', pollResponse.status, errorText);

      if (pollResponse.status === 404) {
        videoOperations.delete(operationId);
        return NextResponse.json({
          success: false,
          status: 'expired',
          error: 'Operation expired. Please generate a new video.',
          shouldPoll: false
        }, { status: 404 });
      }

      return NextResponse.json({
        success: false,
        status: 'poll_error',
        error: `Failed to check status: ${errorText}`,
        shouldPoll: false
      }, { status: pollResponse.status });
    }

    const operation = await pollResponse.json();
    console.log('📋 Poll response:', JSON.stringify(operation, null, 2).substring(0, 500));

    if (operation.done) {
      console.log('✅ Video generation completed!');

      const response = operation.response || operation.result || operation;

      let generatedVideo = null;
      let videoUri = null;

      if (response.generateVideoResponse?.generatedSamples?.[0]) {
        generatedVideo = response.generateVideoResponse.generatedSamples[0];
        videoUri = generatedVideo.video?.uri;
      } else if (response.generatedVideos?.[0]) {
        generatedVideo = response.generatedVideos[0];
        videoUri = generatedVideo.video?.uri;
      } else if (response.generated_videos?.[0]) {
        generatedVideo = response.generated_videos[0];
        videoUri = generatedVideo.video?.uri;
      }

      // Check for RAI (safety filter) blocking before proceeding
      const generateVideoResponse = response.generateVideoResponse || response;
      if (!videoUri && generateVideoResponse.raiMediaFilteredCount > 0) {
        const reasons = generateVideoResponse.raiMediaFilteredReasons || [];
        const reasonText = reasons.length > 0 ? reasons[0] : '';
        const isAudioIssue = reasonText.toLowerCase().includes('audio');

        // If audio-related and caller explicitly allows it, retry with silent model
        if (isAudioIssue && storedOp.allowSilentFallback && !storedOp.isVeo2Retry) {
          console.log('🔇 Audio safety filter triggered — retrying with Veo 2.0 (silent model)...');
          try {
            const { GoogleGenAI } = await import('@google/genai');
            const retryClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

            const retryConfig = { ...storedOp.config };
            // Veo 2 supports dont_allow for personGeneration in text-to-video
            retryConfig.person_generation = 'dont_allow';

            const retryOp = await retryClient.models.generateVideos({
              model: 'veo-2.0-generate-001',
              prompt: storedOp.prompt,
              config: retryConfig,
            });

            const newOperationId = retryOp.name || `veo2_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            videoOperations.set(newOperationId, {
              ...storedOp,
              operation: retryOp,
              status: 'processing',
              startedAt: new Date().toISOString(),
              timestamp: Date.now(),
              isVeo2Retry: true,
            });

            // Mark old operation as retried
            storedOp.status = 'retried';
            videoOperations.set(operationId, storedOp);

            console.log('🔇 Veo 2.0 retry started, new operation:', newOperationId);

            return NextResponse.json({
              success: true,
              status: 'retrying_silent',
              newOperationId,
              message: 'Audio triggered safety filter. Retrying with silent video model...',
            });
          } catch (retryError) {
            console.error('Veo 2.0 retry failed:', retryError.message);
            // Fall through to the content_filtered response below
          }
        }

        storedOp.status = 'failed';
        videoOperations.set(operationId, storedOp);

        return NextResponse.json({
          success: false,
          status: 'content_filtered',
          error: 'Video was blocked by safety filters. Please modify your prompt to avoid restricted content (violence, explicit material, copyrighted characters, etc.) and try again.',
          details: reasonText || undefined,
          shouldPoll: false,
          concept: {
            prompt: storedOp.prompt,
            tip: isAudioIssue
              ? 'Audio-related filtering occurred. Keep dialogue short and natural, avoid copyrighted tracks, and avoid explicit voiceover scripts. You can opt into silent fallback with allowSilentFallback=true.'
              : 'Try rephrasing with more generic, professional language. Avoid mentioning specific people, brands, or controversial topics.',
          }
        });
      }

      if (videoUri) {
        try {
          const videosDir = path.join(process.cwd(), 'public', 'generated-videos');
          await mkdir(videosDir, { recursive: true });

          const videoFileName = generateVideoFileName({
            projectName: storedOp.projectName || storedOp.workflowId || 'draft',
            sceneName: storedOp.sceneName || 'scene',
            promptIndex: storedOp.promptIndex || 0,
          });
          const videoPath = path.join(videosDir, videoFileName);

          console.log('💾 Downloading video...');

          const downloadUrl = videoUri.includes('?')
            ? `${videoUri}&key=${GEMINI_API_KEY}`
            : `${videoUri}?key=${GEMINI_API_KEY}`;

          const videoResponse = await fetch(downloadUrl);

          if (!videoResponse.ok) {
            return NextResponse.json({
              success: false,
              status: 'download_failed',
              error: `Failed to download video: ${videoResponse.status}`,
              shouldPoll: false
            }, { status: 500 });
          }

          const arrayBuffer = await videoResponse.arrayBuffer();
          const videoData = Buffer.from(arrayBuffer);

          if (videoData.length > 0) {
            await writeFile(videoPath, videoData);
            console.log('💾 Video saved! Size:', (videoData.length / 1024 / 1024).toFixed(2), 'MB');

            const videoUrl = `/generated-videos/${videoFileName}`;

            // Persist to MongoDB
            if (storedOp.workflowId) {
              try {
                await dbConnect();

                const existingVideo = await GeneratedVideo.findOne({
                  workflowId: storedOp.workflowId,
                  agentType: storedOp.agentType,
                  promptKey: storedOp.promptKey,
                  userId: storedOp.userId
                });

                if (existingVideo) {
                  existingVideo.localPath = videoUrl;
                  existingVideo.fileName = videoFileName;
                  existingVideo.fileSize = videoData.length;
                  existingVideo.status = 'completed';
                  existingVideo.generatedAt = new Date();
                  await existingVideo.save();
                } else {
                  await GeneratedVideo.create({
                    workflowId: storedOp.workflowId,
                    userId: storedOp.userId,
                    agentId: storedOp.agentId || 'unknown',
                    agentType: storedOp.agentType || 'cinematic-teaser',
                    promptIndex: storedOp.promptIndex || 0,
                    promptKey: storedOp.promptKey || `prompt_${storedOp.promptIndex || 0}`,
                    prompt: storedOp.prompt,
                    sceneName: storedOp.sceneName,
                    sceneDetails: storedOp.sceneDetails,
                    localPath: videoUrl,
                    fileName: videoFileName,
                    fileSize: videoData.length,
                    config: storedOp.config,
                    operationId,
                    projectName: storedOp.projectName,
                    draftName: storedOp.draftName,
                    status: 'completed',
                    generatedAt: new Date()
                  });
                }

                // Update workflow node data with video URL
                if (storedOp.agentId) {
                  try {
                    const workflow = await ScriptWorkflow.findById(storedOp.workflowId);
                    if (workflow && workflow.nodes) {
                      const nodeIndex = workflow.nodes.findIndex(n =>
                        n.id === storedOp.agentId ||
                        n.data?.agentType === storedOp.agentType
                      );

                      if (nodeIndex !== -1) {
                        if (!workflow.nodes[nodeIndex].data.generatedVideos) {
                          workflow.nodes[nodeIndex].data.generatedVideos = {};
                        }
                        workflow.nodes[nodeIndex].data.generatedVideos[storedOp.promptKey] = videoUrl;
                        await workflow.save();
                      }
                    }
                  } catch (workflowError) {
                    console.error('Failed to update workflow node:', workflowError);
                  }
                }
              } catch (dbError) {
                console.error('Failed to save video to database:', dbError);
              }
            }

            storedOp.status = 'completed';
            storedOp.videoUrl = videoUrl;
            storedOp.completedAt = new Date().toISOString();
            videoOperations.set(operationId, storedOp);

            return NextResponse.json({
              success: true,
              status: 'completed',
              videoUrl: videoUrl,
              message: 'Video ready!',
              metadata: {
                prompt: storedOp.prompt?.substring(0, 100),
                config: storedOp.config,
                completedAt: storedOp.completedAt,
                fileSize: `${(videoData.length / 1024 / 1024).toFixed(2)} MB`
              }
            });
          } else {
            return NextResponse.json({
              success: false,
              status: 'empty_video',
              error: 'Downloaded video file is empty',
              shouldPoll: false
            }, { status: 500 });
          }

        } catch (saveError) {
          console.error('Error saving video:', saveError);
          return NextResponse.json({
            success: false,
            status: 'save_error',
            error: 'Video generated but failed to save: ' + saveError.message,
            shouldPoll: false
          }, { status: 500 });
        }
      } else {
        storedOp.status = 'failed';
        videoOperations.set(operationId, storedOp);

        if (operation.error) {
          return NextResponse.json({
            success: false,
            status: 'generation_error',
            error: operation.error.message || 'Video generation failed',
            errorDetails: operation.error,
            shouldPoll: false
          });
        }

        return NextResponse.json({
          success: false,
          status: 'failed',
          error: 'Video generation completed but no video URI was returned',
          shouldPoll: false
        });
      }
    }

    // Still processing
    const elapsed = Math.round((Date.now() - new Date(storedOp.startedAt).getTime()) / 1000);

    return NextResponse.json({
      success: true,
      status: 'processing',
      operationId,
      message: `Generating video... (${elapsed}s elapsed)`,
      elapsed: elapsed
    });

  } catch (error) {
    console.error('Video Status Check Error:', error);
    return NextResponse.json({
      success: false,
      status: 'error',
      error: error.message || 'Failed to check video status',
      shouldPoll: false
    }, { status: 500 });
  }
}
