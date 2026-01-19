/**
 * Rich Media Tools for Mastra Agent
 * OCR, voice transcription, and media analysis tools
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import { richMediaService } from '../../services/richMediaService';
import logger from '../../utils/logger';

/**
 * Tool: Upload Media File
 * Accepts a media file (image/audio/video) and uploads it for processing
 */
export const uploadMediaTool = createTool({
  id: 'uploadMedia',
  description: 'Upload an image, audio, or video file for processing. Returns mediaId for tracking.',
  inputSchema: z.object({
    userId: z.string().describe('Discord user ID'),
    sessionId: z.string().describe('Conversation session ID'),
    fileUrl: z.string().describe('URL of the file to upload'),
    filename: z.string().describe('Original filename'),
    mimeType: z.string().describe('MIME type (e.g., image/png, audio/mpeg)')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    mediaId: z.string().optional(),
    storageUrl: z.string().optional(),
    fileType: z.string().optional(),
    processingStatus: z.string().optional(),
    message: z.string()
  }),
  execute: async ({ context, input }) => {
    try {
      const { userId, sessionId, fileUrl, filename, mimeType } = input;
      
      // In production, we would download the file from fileUrl
      // For now, we'll simulate with empty buffer
      const fileBuffer = Buffer.from(''); // Placeholder
      
      const result = await richMediaService.uploadMedia(
        userId,
        sessionId,
        fileBuffer,
        filename,
        mimeType
      );
      
      return {
        success: true,
        mediaId: result.mediaId,
        storageUrl: result.storageUrl,
        fileType: result.fileType,
        processingStatus: result.processingStatus,
        message: `File uploaded successfully! Media ID: ${result.mediaId}. Processing started.`
      };
      
    } catch (error) {
      logger.error('Error in uploadMediaTool:', error);
      return {
        success: false,
        message: `Failed to upload media: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});

/**
 * Tool: Get OCR Results
 * Retrieve OCR results for an image
 */
export const getOCRResultsTool = createTool({
  id: 'getOCRResults',
  description: 'Get OCR (text extraction) results from an uploaded image. Returns extracted text and error codes.',
  inputSchema: z.object({
    mediaId: z.string().describe('Media ID from upload')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    mediaId: z.string().optional(),
    rawText: z.string().optional(),
    processedText: z.string().optional(),
    errorCodes: z.array(z.string()).optional(),
    confidence: z.number().optional(),
    language: z.string().optional(),
    message: z.string()
  }),
  execute: async ({ context, input }) => {
    try {
      const { mediaId } = input;
      
      const result = await richMediaService.getOCRResults(mediaId);
      
      if (!result) {
        return {
          success: false,
          message: `No OCR results found for media ID ${mediaId}. Processing may still be in progress.`
        };
      }
      
      const errorCodes = result.error_codes ? JSON.parse(result.error_codes) : [];
      
      return {
        success: true,
        mediaId: result.media_id,
        rawText: result.raw_text,
        processedText: result.processed_text,
        errorCodes,
        confidence: parseFloat(result.confidence),
        language: result.language,
        message: `OCR completed. Extracted ${result.processed_text.length} characters with ${errorCodes.length} error codes.`
      };
      
    } catch (error) {
      logger.error('Error in getOCRResultsTool:', error);
      return {
        success: false,
        message: `Failed to get OCR results: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});

/**
 * Tool: Get Voice Transcription
 * Retrieve transcription results for an audio file
 */
export const getTranscriptionTool = createTool({
  id: 'getTranscription',
  description: 'Get voice transcription results from an uploaded audio file. Returns full transcript and segments.',
  inputSchema: z.object({
    mediaId: z.string().describe('Media ID from upload')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    mediaId: z.string().optional(),
    fullTranscript: z.string().optional(),
    segments: z.array(z.object({
      text: z.string(),
      start: z.number(),
      end: z.number()
    })).optional(),
    language: z.string().optional(),
    duration: z.number().optional(),
    message: z.string()
  }),
  execute: async ({ context, input }) => {
    try {
      const { mediaId } = input;
      
      const result = await richMediaService.getTranscription(mediaId);
      
      if (!result) {
        return {
          success: false,
          message: `No transcription found for media ID ${mediaId}. Processing may still be in progress.`
        };
      }
      
      const segments = result.segments ? JSON.parse(result.segments) : [];
      
      return {
        success: true,
        mediaId: result.media_id,
        fullTranscript: result.full_transcript,
        segments,
        language: result.language,
        duration: parseFloat(result.duration_seconds),
        message: `Transcription completed. ${result.full_transcript.length} characters in ${segments.length} segments.`
      };
      
    } catch (error) {
      logger.error('Error in getTranscriptionTool:', error);
      return {
        success: false,
        message: `Failed to get transcription: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});

/**
 * Tool: Get Media Processing Status
 * Check the status of a media file being processed
 */
export const getMediaStatusTool = createTool({
  id: 'getMediaStatus',
  description: 'Check the processing status of an uploaded media file. Returns status, extracted content if available.',
  inputSchema: z.object({
    mediaId: z.string().describe('Media ID from upload')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    mediaId: z.string().optional(),
    fileType: z.string().optional(),
    processingStatus: z.string().optional(),
    extractedContent: z.string().optional(),
    confidenceScore: z.number().optional(),
    uploadedAt: z.string().optional(),
    processedAt: z.string().optional(),
    message: z.string()
  }),
  execute: async ({ context, input }) => {
    try {
      const { mediaId } = input;
      
      const media = await richMediaService.getMediaFile(mediaId);
      
      if (!media) {
        return {
          success: false,
          message: `Media file ${mediaId} not found.`
        };
      }
      
      const extractedContent = media.ocr_text || media.transcription || null;
      
      return {
        success: true,
        mediaId: media.media_id,
        fileType: media.file_type,
        processingStatus: media.processing_status,
        extractedContent,
        confidenceScore: media.confidence_score ? parseFloat(media.confidence_score) : undefined,
        uploadedAt: media.uploaded_at,
        processedAt: media.processed_at,
        message: `Status: ${media.processing_status}. ${extractedContent ? 'Content extracted.' : 'Processing in progress.'}`
      };
      
    } catch (error) {
      logger.error('Error in getMediaStatusTool:', error);
      return {
        success: false,
        message: `Failed to get media status: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});

/**
 * Tool: Analyze Station Image
 * Use GPT-4V to analyze an uploaded image of a charging station
 */
export const analyzeStationImageAdvancedTool = createTool({
  id: 'analyzeStationImageAdvanced',
  description: 'Analyze an uploaded charging station image using GPT-4V. Identifies errors, screen messages, and visual issues.',
  inputSchema: z.object({
    mediaId: z.string().describe('Media ID from upload'),
    context: z.string().optional().describe('Additional context about the issue')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    mediaId: z.string().optional(),
    analysis: z.string().optional(),
    message: z.string()
  }),
  execute: async ({ context, input }) => {
    try {
      const { mediaId, context: userContext } = input;
      
      // Get media file
      const media = await richMediaService.getMediaFile(mediaId);
      
      if (!media || media.file_type !== 'image') {
        return {
          success: false,
          message: `Media ${mediaId} not found or is not an image.`
        };
      }
      
      const result = await richMediaService.analyzeImage(
        mediaId,
        media.storage_url,
        userContext
      );
      
      return {
        success: true,
        mediaId: result.mediaId,
        analysis: result.analysis,
        message: `Image analyzed successfully.`
      };
      
    } catch (error) {
      logger.error('Error in analyzeStationImageAdvancedTool:', error);
      return {
        success: false,
        message: `Failed to analyze image: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});

/**
 * Tool: Get Recent Media Uploads
 * Retrieve recent media uploads for a user or session
 */
export const getRecentMediaTool = createTool({
  id: 'getRecentMedia',
  description: 'Get a list of recent media uploads. Useful for tracking conversation media.',
  inputSchema: z.object({
    limit: z.number().optional().default(10).describe('Maximum number of results')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    uploads: z.array(z.object({
      mediaId: z.string(),
      userId: z.string(),
      fileType: z.string(),
      processingStatus: z.string(),
      uploadedAt: z.string(),
      extractedContent: z.string().optional()
    })).optional(),
    count: z.number().optional(),
    message: z.string()
  }),
  execute: async ({ context, input }) => {
    try {
      const { limit } = input;
      
      const uploads = await richMediaService.getRecentUploads(limit);
      
      const formattedUploads = uploads.map((u: any) => ({
        mediaId: u.media_id,
        userId: u.discord_user_id,
        fileType: u.file_type,
        processingStatus: u.processing_status,
        uploadedAt: u.uploaded_at,
        extractedContent: u.extracted_content
      }));
      
      return {
        success: true,
        uploads: formattedUploads,
        count: formattedUploads.length,
        message: `Found ${formattedUploads.length} recent uploads.`
      };
      
    } catch (error) {
      logger.error('Error in getRecentMediaTool:', error);
      return {
        success: false,
        message: `Failed to get recent media: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});
