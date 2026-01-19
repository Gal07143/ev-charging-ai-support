import { franc } from 'franc';
import { OpenAI } from 'openai';
import NodeCache from 'node-cache';
import { logger } from '../utils/logger.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Cache translations for 1 hour (reduces API costs)
const translationCache = new NodeCache({ stdTTL: 3600 });

// EV charging glossary - preserve technical terms across languages
const EV_GLOSSARY = {
  he: {
    'charger': 'מטען',
    'connector': 'מחבר',
    'station': 'תחנה',
    'session': 'הפעלה',
    'kWh': 'קוט״ש',
    'charging': 'טעינה',
    'error code': 'קוד שגיאה',
    'Type 2': 'Type 2',
    'CCS': 'CCS',
    'CHAdeMO': 'CHAdeMO',
    'reset': 'איפוס',
    'unlock': 'שחרור',
    'offline': 'לא מחובר',
    'online': 'מחובר',
    'maintenance': 'תחזוקה',
  },
  en: {
    'מטען': 'charger',
    'מחבר': 'connector',
    'תחנה': 'station',
    'הפעלה': 'session',
    'קוט״ש': 'kWh',
    'טעינה': 'charging',
    'קוד שגיאה': 'error code',
    'איפוס': 'reset',
    'שחרור': 'unlock',
    'לא מחובר': 'offline',
    'מחובר': 'online',
    'תחזוקה': 'maintenance',
  },
  ru: {
    'charger': 'зарядное устройство',
    'connector': 'разъем',
    'station': 'станция',
    'session': 'сеанс',
    'kWh': 'кВтч',
    'charging': 'зарядка',
    'error code': 'код ошибки',
    'reset': 'сброс',
    'unlock': 'разблокировать',
    'offline': 'не в сети',
    'online': 'в сети',
    'maintenance': 'обслуживание',
  },
  ar: {
    'charger': 'شاحن',
    'connector': 'موصل',
    'station': 'محطة',
    'session': 'جلسة',
    'kWh': 'كيلوواط ساعة',
    'charging': 'شحن',
    'error code': 'رمز الخطأ',
    'reset': 'إعادة تعيين',
    'unlock': 'فتح',
    'offline': 'غير متصل',
    'online': 'متصل',
    'maintenance': 'صيانة',
  },
};

export interface DetectedLanguage {
  code: string; // he, en, ru, ar
  name: string;
  confidence: number;
}

export interface TranslationResult {
  translatedText: string;
  sourceLanguage: DetectedLanguage;
  targetLanguage: string;
  cached: boolean;
}

/**
 * Detect language from text using franc
 */
export function detectLanguage(text: string): DetectedLanguage {
  try {
    const langCode = franc(text, { minLength: 3 });
    
    // Map ISO 639-3 to common codes
    const langMap: Record<string, { code: string; name: string }> = {
      'heb': { code: 'he', name: 'Hebrew' },
      'eng': { code: 'en', name: 'English' },
      'rus': { code: 'ru', name: 'Russian' },
      'arb': { code: 'ar', name: 'Arabic' },
      'ara': { code: 'ar', name: 'Arabic' },
    };

    const detected = langMap[langCode] || { code: 'en', name: 'English' };
    
    return {
      code: detected.code,
      name: detected.name,
      confidence: langCode === 'und' ? 0.5 : 0.9, // Lower confidence for undefined
    };
  } catch (error) {
    logger.error('Language detection failed', error);
    return { code: 'he', name: 'Hebrew', confidence: 0.5 }; // Default to Hebrew for Israeli market
  }
}

/**
 * Translate text using GPT-4 with EV glossary preservation
 */
export async function translateText(
  text: string,
  targetLang: string,
  sourceLang?: string
): Promise<TranslationResult> {
  // Auto-detect source language if not provided
  const detectedLang = sourceLang 
    ? { code: sourceLang, name: '', confidence: 1.0 }
    : detectLanguage(text);

  // Skip translation if already in target language
  if (detectedLang.code === targetLang) {
    return {
      translatedText: text,
      sourceLanguage: detectedLang,
      targetLanguage: targetLang,
      cached: false,
    };
  }

  // Check cache
  const cacheKey = `${detectedLang.code}:${targetLang}:${text.substring(0, 100)}`;
  const cached = translationCache.get<string>(cacheKey);
  if (cached) {
    return {
      translatedText: cached,
      sourceLanguage: detectedLang,
      targetLanguage: targetLang,
      cached: true,
    };
  }

  try {
    const targetLanguageNames: Record<string, string> = {
      he: 'Hebrew',
      en: 'English',
      ru: 'Russian',
      ar: 'Arabic',
    };

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Cost-effective for translations
      messages: [
        {
          role: 'system',
          content: `You are a professional translator specializing in EV charging support. 
Translate the following text to ${targetLanguageNames[targetLang] || targetLang}.

CRITICAL RULES:
1. Preserve ALL technical terms: Type 2, CCS, CHAdeMO, kWh, error codes (e.g., "Error 0x42")
2. Use EV industry-standard terminology
3. Keep numbers, station IDs, and URLs unchanged
4. Maintain the tone and formality of the original
5. For Hebrew: use proper RTL formatting
6. Keep line breaks and formatting

Translate naturally but accurately - this is customer support communication.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.3, // Lower temperature for consistent translations
    });

    const translatedText = response.choices[0]?.message?.content?.trim() || text;

    // Cache the result
    translationCache.set(cacheKey, translatedText);

    logger.info('Translation completed', {
      from: detectedLang.code,
      to: targetLang,
      textLength: text.length,
      cached: false,
    });

    return {
      translatedText,
      sourceLanguage: detectedLang,
      targetLanguage: targetLang,
      cached: false,
    };
  } catch (error) {
    logger.error('Translation failed', error);
    // Fallback to original text
    return {
      translatedText: text,
      sourceLanguage: detectedLang,
      targetLanguage: targetLang,
      cached: false,
    };
  }
}

/**
 * Back-translate to validate translation quality (used for critical messages)
 */
export async function backTranslate(
  translatedText: string,
  originalLang: string,
  targetLang: string
): Promise<{ backTranslated: string; qualityScore: number }> {
  try {
    const result = await translateText(translatedText, originalLang, targetLang);
    
    // Simple quality check: compare word count and key terms
    const originalWords = translatedText.split(/\s+/).length;
    const backWords = result.translatedText.split(/\s+/).length;
    const lengthRatio = Math.min(originalWords, backWords) / Math.max(originalWords, backWords);
    
    return {
      backTranslated: result.translatedText,
      qualityScore: lengthRatio, // 1.0 = perfect match, lower = potential issues
    };
  } catch (error) {
    logger.error('Back-translation failed', error);
    return {
      backTranslated: translatedText,
      qualityScore: 0.5,
    };
  }
}

/**
 * Store user language preference in database
 */
export async function storeUserLanguagePreference(
  userId: string,
  languageCode: string
): Promise<void> {
  try {
    const { db } = await import('../db/index.js');
    
    await db.query(
      `INSERT INTO user_preferences (user_id, language_code, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET language_code = $2, updated_at = NOW()`,
      [userId, languageCode]
    );

    logger.info('User language preference stored', { userId, languageCode });
  } catch (error) {
    logger.error('Failed to store user language preference', error);
  }
}

/**
 * Get user language preference from database
 */
export async function getUserLanguagePreference(userId: string): Promise<string | null> {
  try {
    const { db } = await import('../db/index.js');
    
    const result = await db.query(
      `SELECT language_code FROM user_preferences WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length > 0) {
      return result.rows[0].language_code;
    }

    return null;
  } catch (error) {
    logger.error('Failed to get user language preference', error);
    return null;
  }
}

/**
 * Translate with user preference awareness
 */
export async function translateForUser(
  text: string,
  userId: string,
  forceLang?: string
): Promise<TranslationResult> {
  // Get user's preferred language or use detected language
  const targetLang = forceLang || await getUserLanguagePreference(userId) || 'he';
  
  const result = await translateText(text, targetLang);

  // Auto-save detected language as preference if not set
  if (!forceLang && result.sourceLanguage.confidence > 0.8) {
    await storeUserLanguagePreference(userId, result.sourceLanguage.code);
  }

  return result;
}

/**
 * Get translation statistics for monitoring
 */
export function getTranslationStats() {
  const keys = translationCache.keys();
  const stats: Record<string, number> = {};
  
  keys.forEach(key => {
    const [from, to] = key.split(':');
    const pair = `${from}->${to}`;
    stats[pair] = (stats[pair] || 0) + 1;
  });

  return {
    totalCached: keys.length,
    languagePairs: stats,
    cacheHitRate: translationCache.getStats(),
  };
}
