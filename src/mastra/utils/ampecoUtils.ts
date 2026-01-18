import NodeCache from 'node-cache';

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20;

// Cache configuration (5 minutes TTL)
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limiter for user messages
 */
export function checkRateLimit(userId: string): { allowed: boolean; resetIn?: number } {
  const now = Date.now();
  const userLimit = rateLimitStore.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    // New window
    rateLimitStore.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return { allowed: true };
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      resetIn: Math.ceil((userLimit.resetTime - now) / 1000),
    };
  }

  userLimit.count++;
  return { allowed: true };
}

/**
 * Ampeco API configuration
 */
const AMPECO_API_KEY = process.env.AMPECO_API_KEY || '';
const AMPECO_TENANT_URL = process.env.AMPECO_TENANT_URL || '';

/**
 * Base Ampeco API request function
 */
export async function ampecoRequest<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: any;
    useCache?: boolean;
    cacheTTL?: number;
  } = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  const { method = 'GET', body, useCache = true, cacheTTL = 300 } = options;

  // Check cache for GET requests
  const cacheKey = `ampeco:${method}:${endpoint}:${JSON.stringify(body || {})}`;
  if (method === 'GET' && useCache) {
    const cached = cache.get<T>(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }
  }

  try {
    const url = `${AMPECO_TENANT_URL}${endpoint}`;
    const headers: HeadersInit = {
      'Authorization': `Bearer ${AMPECO_API_KEY}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Ampeco API error (${response.status}):`, errorText);
      return {
        success: false,
        error: `API request failed: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();

    // Cache successful GET requests
    if (method === 'GET' && useCache) {
      cache.set(cacheKey, data, cacheTTL);
    }

    return { success: true, data };
  } catch (error) {
    console.error('Ampeco API request error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Find station by socket number
 */
export async function findStationBySocketNumber(
  socketNumber: string
): Promise<{ success: boolean; station?: any; evse?: any; error?: string }> {
  try {
    // Search for station by socket number
    const result = await ampecoRequest<any>('/api/v1/stations', {
      method: 'GET',
    });

    if (!result.success || !result.data) {
      return { success: false, error: 'Failed to fetch stations' };
    }

    // Find station with matching socket number
    for (const station of result.data.stations || []) {
      for (const evse of station.evses || []) {
        if (evse.socketNumber === socketNumber || evse.uid === socketNumber) {
          return { success: true, station, evse };
        }
      }
    }

    return { success: false, error: `Station with socket number ${socketNumber} not found` };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get station status
 */
export async function getStationStatus(stationId: string) {
  return ampecoRequest(`/api/v1/stations/${stationId}`, {
    method: 'GET',
    useCache: true,
    cacheTTL: 60, // 1 minute cache for real-time status
  });
}

/**
 * Reset station
 */
export async function resetStation(stationId: string, resetType: 'soft' | 'hard' = 'soft') {
  return ampecoRequest(`/api/v1/stations/${stationId}/reset`, {
    method: 'POST',
    body: { type: resetType },
    useCache: false,
  });
}

/**
 * Unlock connector
 */
export async function unlockConnector(evseId: string) {
  return ampecoRequest(`/api/v1/evses/${evseId}/unlock`, {
    method: 'POST',
    useCache: false,
  });
}

/**
 * Get active charging session
 */
export async function getActiveSession(stationId: string) {
  return ampecoRequest(`/api/v1/stations/${stationId}/active-session`, {
    method: 'GET',
    useCache: true,
    cacheTTL: 30, // 30 seconds cache
  });
}

/**
 * Get session history
 */
export async function getSessionHistory(userId: string, limit: number = 5) {
  return ampecoRequest(`/api/v1/sessions?userId=${userId}&limit=${limit}`, {
    method: 'GET',
    useCache: true,
    cacheTTL: 300, // 5 minutes cache
  });
}

/**
 * Get tariff information
 */
export async function getTariffInfo(stationId: string) {
  return ampecoRequest(`/api/v1/stations/${stationId}/tariff`, {
    method: 'GET',
    useCache: true,
    cacheTTL: 3600, // 1 hour cache
  });
}

/**
 * Clear cache for a specific key pattern
 */
export function clearCache(pattern?: string) {
  if (pattern) {
    const keys = cache.keys();
    keys.forEach(key => {
      if (key.includes(pattern)) {
        cache.del(key);
      }
    });
  } else {
    cache.flushAll();
  }
}

/**
 * Detect if message is a greeting (new conversation)
 */
export function isGreeting(message: string): boolean {
  const greetings = [
    // Hebrew
    'שלום', 'היי', 'הי', 'בוקר טוב', 'ערב טוב', 'צהריים טובים',
    'מה נשמע', 'מה המצב', 'אהלן', 'שלומות',
    // English
    'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
    'greetings', 'howdy', 'yo',
    // Russian
    'привет', 'здравствуйте', 'добрый день', 'доброе утро', 'добрый вечер',
    // Arabic
    'مرحبا', 'أهلا', 'السلام عليكم', 'صباح الخير', 'مساء الخير',
  ];

  const normalizedMessage = message.toLowerCase().trim();
  return greetings.some(greeting => normalizedMessage.includes(greeting));
}

/**
 * Detect language from text
 */
export function detectLanguage(text: string): 'he' | 'en' | 'ru' | 'ar' | 'unknown' {
  // Hebrew
  if (/[\u0590-\u05FF]/.test(text)) return 'he';
  // Arabic
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  // Russian (Cyrillic)
  if (/[\u0400-\u04FF]/.test(text)) return 'ru';
  // English (default for Latin characters)
  if (/[a-zA-Z]/.test(text)) return 'en';
  
  return 'unknown';
}
