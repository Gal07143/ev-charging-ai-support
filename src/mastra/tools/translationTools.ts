import { createTool } from '@mastra/core';
import { z } from 'zod';
import { translateText, detectLanguage, getUserLanguagePreference } from '../../services/translationService.js';
import { logger } from '../../utils/logger.js';

/**
 * Tool: Detect Language
 * Auto-detect the language of user input
 */
export const detectLanguageTool = createTool({
  id: 'detectLanguage',
  description: 'Detect the language of a text. Supports Hebrew, English, Russian, and Arabic.',
  inputSchema: z.object({
    text: z.string().describe('Text to detect language from'),
  }),
  execute: async ({ context }) => {
    try {
      const { text } = context;
      const detected = detectLanguage(text);
      
      logger.info('Language detected', { detected });
      
      return {
        success: true,
        language: detected.name,
        code: detected.code,
        confidence: detected.confidence,
      };
    } catch (error: any) {
      logger.error('Language detection failed', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Tool: Translate Text
 * Translate text between supported languages with EV glossary preservation
 */
export const translateTextTool = createTool({
  id: 'translateText',
  description: `Translate text between Hebrew (he), English (en), Russian (ru), and Arabic (ar). 
  Preserves technical EV terms like "Type 2", "CCS", "kWh", error codes.
  Use this when user writes in a different language than agent's response language.`,
  inputSchema: z.object({
    text: z.string().describe('Text to translate'),
    targetLanguage: z.enum(['he', 'en', 'ru', 'ar']).describe('Target language code'),
    sourceLanguage: z.enum(['he', 'en', 'ru', 'ar']).optional().describe('Source language (auto-detected if not provided)'),
  }),
  execute: async ({ context }) => {
    try {
      const { text, targetLanguage, sourceLanguage } = context;
      
      const result = await translateText(text, targetLanguage, sourceLanguage);
      
      logger.info('Translation completed', {
        from: result.sourceLanguage.code,
        to: result.targetLanguage,
        cached: result.cached,
      });
      
      return {
        success: true,
        translatedText: result.translatedText,
        sourceLanguage: result.sourceLanguage.code,
        targetLanguage: result.targetLanguage,
        cached: result.cached,
      };
    } catch (error: any) {
      logger.error('Translation failed', error);
      return {
        success: false,
        error: error.message,
        originalText: context.text,
      };
    }
  },
});

/**
 * Tool: Get User Language Preference
 * Retrieve user's preferred language from database
 */
export const getUserLanguageTool = createTool({
  id: 'getUserLanguage',
  description: 'Get user preferred language from their profile. Returns null if not set.',
  inputSchema: z.object({
    userId: z.string().describe('Discord user ID'),
  }),
  execute: async ({ context }) => {
    try {
      const { userId } = context;
      const languageCode = await getUserLanguagePreference(userId);
      
      return {
        success: true,
        userId,
        languageCode: languageCode || 'not_set',
        hasPreference: !!languageCode,
      };
    } catch (error: any) {
      logger.error('Failed to get user language', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});
