import { Hono } from 'hono';
import { logger } from '../utils/logger';

type Bindings = {
  DB: D1Database;
  R2?: R2Bucket;
};

const media = new Hono<{ Bindings: Bindings }>();

/**
 * Upload media file (image, video, audio)
 * POST /api/media/upload
 */
media.post('/upload', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const threadId = formData.get('threadId') as string;
    const mediaType = formData.get('type') as string || 'image';

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    if (!threadId) {
      return c.json({ error: 'Thread ID required' }, 400);
    }

    const db = c.env.DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    // Generate unique file ID
    const fileId = `media-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const fileExtension = file.name.split('.').pop() || 'bin';
    const fileName = `${fileId}.${fileExtension}`;

    // Read file as buffer
    const fileBuffer = await file.arrayBuffer();
    const fileSize = fileBuffer.byteLength;

    // Store file data as base64 in database (for small files)
    // For production, use R2 or external storage
    const base64Data = Buffer.from(fileBuffer).toString('base64');

    // Save media file record
    await db.prepare(`
      INSERT INTO media_files (
        file_id, thread_id, file_name, file_type, file_size, 
        mime_type, storage_path, upload_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'uploaded')
    `).bind(
      fileId,
      threadId,
      file.name,
      mediaType,
      fileSize,
      file.type,
      `data:${file.type};base64,${base64Data}`
    ).run();

    // Queue for processing based on type
    if (mediaType === 'image') {
      await db.prepare(`
        INSERT INTO media_processing_queue (
          file_id, processing_type, priority, status
        ) VALUES (?, 'ocr', 5, 'pending')
      `).bind(fileId).run();
    } else if (mediaType === 'audio') {
      await db.prepare(`
        INSERT INTO media_processing_queue (
          file_id, processing_type, priority, status
        ) VALUES (?, 'transcription', 5, 'pending')
      `).bind(fileId).run();
    } else if (mediaType === 'video') {
      await db.prepare(`
        INSERT INTO media_processing_queue (
          file_id, processing_type, priority, status
        ) VALUES (?, 'video_analysis', 5, 'pending')
      `).bind(fileId).run();
    }

    logger.info({
      fileId,
      threadId,
      fileName: file.name,
      fileSize,
      mediaType,
    }, 'Media file uploaded');

    return c.json({
      success: true,
      fileId,
      fileName: file.name,
      fileSize,
      mediaType,
      message: 'File uploaded successfully and queued for processing',
    });
  } catch (error) {
    logger.error({ error }, 'Media upload error');
    return c.json({
      error: error instanceof Error ? error.message : 'Upload failed',
    }, 500);
  }
});

/**
 * Get media file processing status
 * GET /api/media/:fileId/status
 */
media.get('/:fileId/status', async (c) => {
  try {
    const fileId = c.req.param('fileId');
    const db = c.env.DB;

    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    // Get file info
    const fileInfo = await db.prepare('SELECT * FROM media_files WHERE file_id = ?')
      .bind(fileId)
      .first();

    if (!fileInfo) {
      return c.json({ error: 'File not found' }, 404);
    }

    // Get processing status
    const processingQueue = await db.prepare(`
      SELECT * FROM media_processing_queue 
      WHERE file_id = ? 
      ORDER BY created_at DESC
    `).bind(fileId).all();

    // Get results
    const ocrResults = await db.prepare('SELECT * FROM ocr_results WHERE file_id = ?')
      .bind(fileId).all();
    
    const transcriptions = await db.prepare('SELECT * FROM voice_transcriptions WHERE file_id = ?')
      .bind(fileId).all();
    
    const videoAnalysis = await db.prepare('SELECT * FROM video_analysis_results WHERE file_id = ?')
      .bind(fileId).all();

    return c.json({
      success: true,
      file: fileInfo,
      processing: processingQueue.results || [],
      results: {
        ocr: ocrResults.results || [],
        transcriptions: transcriptions.results || [],
        videoAnalysis: videoAnalysis.results || [],
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get media status');
    return c.json({ error: 'Failed to get status' }, 500);
  }
});

/**
 * Get media file
 * GET /api/media/:fileId
 */
media.get('/:fileId', async (c) => {
  try {
    const fileId = c.req.param('fileId');
    const db = c.env.DB;

    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const fileInfo = await db.prepare('SELECT * FROM media_files WHERE file_id = ?')
      .bind(fileId)
      .first();

    if (!fileInfo) {
      return c.json({ error: 'File not found' }, 404);
    }

    // Return file data (for now, return base64)
    // In production, redirect to R2 or CDN URL
    return c.json({
      success: true,
      fileId,
      fileName: fileInfo.file_name,
      mimeType: fileInfo.mime_type,
      fileSize: fileInfo.file_size,
      data: fileInfo.storage_path, // base64 data URL
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get media file');
    return c.json({ error: 'Failed to get file' }, 500);
  }
});

/**
 * List recent media uploads
 * GET /api/media
 */
media.get('/', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '20');
    const db = c.env.DB;

    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const files = await db.prepare(`
      SELECT 
        file_id, thread_id, file_name, file_type, 
        file_size, mime_type, upload_status, uploaded_at
      FROM media_files
      ORDER BY uploaded_at DESC
      LIMIT ?
    `).bind(limit).all();

    return c.json({
      success: true,
      files: files.results || [],
    });
  } catch (error) {
    logger.error({ error }, 'Failed to list media files');
    return c.json({ error: 'Failed to list files' }, 500);
  }
});

export default media;
