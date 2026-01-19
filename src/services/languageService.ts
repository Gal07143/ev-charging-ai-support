import { franc } from 'franc';
import { logger } from '../utils/logger';
import { pgPool } from '../mastra/storage';

/**
 * Multi-Language Translation Service
 * 
 * Provides:
 * 1. Language detection with confidence scoring
 * 2. User language preference storage
 * 3. EV-specific multilingual glossary
 * 4. Consistent language experience
 */

export type SupportedLanguage = 'he' | 'en' | 'ru' | 'ar';

export interface LanguageDetectionResult {
  language: SupportedLanguage;
  confidence: number;
  detected: string; // franc code (heb, eng, rus, arb)
}

export interface UserLanguagePreference {
  userId: string;
  language: SupportedLanguage;
  detectedLanguage?: SupportedLanguage;
  confidence?: number;
  lastUpdated: Date;
}

// EV-specific multilingual glossary
// Technical terms that should NOT be translated
const EV_GLOSSARY = {
  // Connector types
  'CCS': { preserve: true, aliases: ['CCS Combo', 'CCS2', 'CCS1'] },
  'CHAdeMO': { preserve: true, aliases: ['Chademo', 'CHAdeMO'] },
  'Type 2': { preserve: true, aliases: ['Type2', 'Mennekes'] },
  'Tesla': { preserve: true, aliases: [] },
  
  // Charger manufacturers
  'ABB': { preserve: true },
  'Tritium': { preserve: true },
  'Kempower': { preserve: true },
  'Delta': { preserve: true },
  'Efacec': { preserve: true },
  'Siemens': { preserve: true },
  'ChargePoint': { preserve: true },
  
  // Power units
  'kW': { preserve: true, aliases: ['kilowatt', 'קילוואט'] },
  'kWh': { preserve: true, aliases: ['kilowatt-hour', 'קילוואט-שעה'] },
  'AC': { preserve: true },
  'DC': { preserve: true },
  
  // Technical terms
  'OCPP': { preserve: true },
  'RFID': { preserve: true },
  'SOC': { preserve: true, fullName: 'State of Charge' },
  'BMS': { preserve: true, fullName: 'Battery Management System' },
};

// Language code mapping
const FRANC_TO_ISO: Record<string, SupportedLanguage> = {
  'heb': 'he',  // Hebrew
  'eng': 'en',  // English
  'rus': 'ru',  // Russian
  'arb': 'ar',  // Arabic
};

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['he', 'en', 'ru', 'ar'];

export class MultiLanguageService {
  
  /**
   * Detect language from text
   */
  detectLanguage(text: string): LanguageDetectionResult {
    try {
      // Clean text for detection
      const cleanText = text.trim();
      
      if (cleanText.length < 10) {
        // Default to Hebrew for very short text
        return {
          language: 'he',
          confidence: 0.5,
          detected: 'heb',
        };
      }

      // Use franc for detection
      const detected = franc(cleanText, { minLength: 10 });
      
      // Map to supported language
      const language = FRANC_TO_ISO[detected] || 'he';
      
      // Calculate confidence based on text length and clarity
      const confidence = this.calculateConfidence(text, detected);

      logger.debug('Language detected', {
        language,
        detected,
        confidence,
        textLength: text.length,
      });

      return {
        language,
        confidence,
        detected,
      };
    } catch (error) {
      logger.error('Language detection failed', { error, text: text.substring(0, 100) });
      
      // Fallback to Hebrew
      return {
        language: 'he',
        confidence: 0.3,
        detected: 'unknown',
      };
    }
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(text: string, francCode: string): number {
    // Base confidence
    let confidence = 0.7;

    // Adjust based on text length
    if (text.length < 20) {
      confidence -= 0.2;
    } else if (text.length > 100) {
      confidence += 0.1;
    }

    // Check if franc detected 'und' (undetermined)
    if (francCode === 'und') {
      confidence = 0.3;
    }

    // Ensure confidence is between 0 and 1
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Get or detect user language preference
   */
  async getUserLanguage(userId: string, currentText?: string): Promise<SupportedLanguage> {
    try {
      // Check database for saved preference
      const result = await pgPool.query(
        `SELECT language FROM user_language_preferences WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length > 0) {
        const saved = result.rows[0].language as SupportedLanguage;
        logger.debug('Using saved language preference', { userId, language: saved });
        return saved;
      }

      // No saved preference - detect from current text
      if (currentText) {
        const detection = this.detectLanguage(currentText);
        
        // Save if confidence is high
        if (detection.confidence >= 0.7) {
          await this.saveUserLanguage(userId, detection.language, detection.confidence);
        }

        return detection.language;
      }

      // Default to Hebrew
      return 'he';
    } catch (error) {
      logger.error('Failed to get user language', { error, userId });
      return 'he';
    }
  }

  /**
   * Save user language preference
   */
  async saveUserLanguage(
    userId: string,
    language: SupportedLanguage,
    confidence?: number
  ): Promise<void> {
    try {
      await pgPool.query(
        `
        INSERT INTO user_language_preferences (user_id, language, confidence, last_updated)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          language = EXCLUDED.language,
          confidence = EXCLUDED.confidence,
          last_updated = EXCLUDED.last_updated
        `,
        [userId, language, confidence || 1.0]
      );

      logger.info('User language preference saved', { userId, language, confidence });
    } catch (error) {
      logger.error('Failed to save user language', { error, userId, language });
    }
  }

  /**
   * Get localized response templates
   */
  getResponseTemplates(language: SupportedLanguage): Record<string, string> {
    const templates = {
      he: {
        greeting: 'שלום! איך אוכל לעזור לך היום?',
        askName: 'מה שמך?',
        thanks: 'תודה רבה',
        working: 'אני בודק עכשיו...',
        error: 'מצטער, נתקלתי בבעיה. אנסה שוב.',
        escalate: 'אני מעביר אותך לנציג אנושי שיוכל לעזור.',
        goodbye: 'שיהיה לך יום מצוין!',
        rateLimit: 'אנא המתן {seconds} שניות לפני שליחת הודעה נוספת.',
      },
      en: {
        greeting: 'Hello! How can I help you today?',
        askName: 'What is your name?',
        thanks: 'Thank you very much',
        working: 'Checking now...',
        error: 'Sorry, I encountered a problem. I\'ll try again.',
        escalate: 'I\'m transferring you to a human agent who can help.',
        goodbye: 'Have a great day!',
        rateLimit: 'Please wait {seconds} seconds before sending another message.',
      },
      ru: {
        greeting: 'Здравствуйте! Как я могу вам помочь сегодня?',
        askName: 'Как вас зовут?',
        thanks: 'Большое спасибо',
        working: 'Проверяю сейчас...',
        error: 'Извините, я столкнулся с проблемой. Попробую снова.',
        escalate: 'Я передаю вас агенту-человеку, который сможет помочь.',
        goodbye: 'Хорошего дня!',
        rateLimit: 'Пожалуйста, подождите {seconds} секунд перед отправкой следующего сообщения.',
      },
      ar: {
        greeting: 'مرحبا! كيف يمكنني مساعدتك اليوم؟',
        askName: 'ما اسمك؟',
        thanks: 'شكرا جزيلا',
        working: 'أتحقق الآن...',
        error: 'آسف، واجهت مشكلة. سأحاول مرة أخرى.',
        escalate: 'أنا أنقلك إلى وكيل بشري يمكنه المساعدة.',
        goodbye: 'أتمنى لك يوما سعيدا!',
        rateLimit: 'يرجى الانتظار {seconds} ثانية قبل إرسال رسالة أخرى.',
      },
    };

    return templates[language] || templates.he;
  }

  /**
   * Check if term is in EV glossary (should not be translated)
   */
  isGlossaryTerm(term: string): boolean {
    const normalizedTerm = term.trim().toUpperCase();
    
    // Check exact match
    if (EV_GLOSSARY[normalizedTerm]) {
      return EV_GLOSSARY[normalizedTerm].preserve;
    }

    // Check aliases
    for (const [key, value] of Object.entries(EV_GLOSSARY)) {
      if (value.aliases && value.aliases.some(alias => 
        alias.toUpperCase() === normalizedTerm
      )) {
        return value.preserve;
      }
    }

    return false;
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return SUPPORTED_LANGUAGES;
  }

  /**
   * Format language name
   */
  getLanguageName(code: SupportedLanguage, inLanguage?: SupportedLanguage): string {
    const names = {
      he: { he: 'עברית', en: 'Hebrew', ru: 'Иврит', ar: 'العبرية' },
      en: { he: 'אנגלית', en: 'English', ru: 'Английский', ar: 'الإنجليزية' },
      ru: { he: 'רוסית', en: 'Russian', ru: 'Русский', ar: 'الروسية' },
      ar: { he: 'ערבית', en: 'Arabic', ru: 'Арабский', ar: 'العربية' },
    };

    const displayLang = inLanguage || code;
    return names[code]?.[displayLang] || code;
  }
}

// Singleton instance
let languageServiceInstance: MultiLanguageService | null = null;

export function getLanguageService(): MultiLanguageService {
  if (!languageServiceInstance) {
    languageServiceInstance = new MultiLanguageService();
  }
  return languageServiceInstance;
}
