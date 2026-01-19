import NodeCache from 'node-cache';
import { logger } from '../../utils/logger';

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20;

// Cache configuration (5 minutes TTL)
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Helper function for delays
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
 * Base Ampeco API request function with retry logic
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
  const maxRetries = 3;

  // Check cache for GET requests
  const cacheKey = `ampeco:${method}:${endpoint}:${JSON.stringify(body || {})}`;
  if (method === 'GET' && useCache) {
    const cached = cache.get<T>(cacheKey);
    if (cached) {
      logger.debug({ cacheKey }, 'Ampeco API cache hit');
      return { success: true, data: cached };
    }
  }

  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const url = `${AMPECO_TENANT_URL}${endpoint}`;
      const headers: HeadersInit = {
        'Authorization': `Bearer ${AMPECO_API_KEY}`,
        'Content-Type': 'application/json',
      };

      logger.debug({ method, url, attempt }, 'Ampeco API request');

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '2') * 1000;
        logger.warn({ attempt, retryAfter }, 'Ampeco API rate limited, retrying...');
        
        if (attempt < maxRetries) {
          await sleep(retryAfter);
          continue;
        }
        
        return {
          success: false,
          error: 'API rate limit exceeded. Please try again later.',
        };
      }

      // Handle server errors with retry
      if (response.status >= 500) {
        logger.warn({ status: response.status, attempt }, 'Ampeco API server error, retrying...');
        
        if (attempt < maxRetries) {
          await sleep(1000 * attempt); // Exponential backoff
          continue;
        }
        
        return {
          success: false,
          error: `API server error: ${response.status}`,
        };
      }

      // Handle client errors (don't retry)
      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ status: response.status, errorText }, 'Ampeco API client error');
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

      logger.debug({ method, url }, 'Ampeco API request successful');
      return { success: true, data };

    } catch (error) {
      lastError = error;
      logger.error({ error, attempt }, 'Ampeco API request error');
      
      if (attempt < maxRetries) {
        await sleep(1000 * attempt); // Exponential backoff
      }
    }
  }

  return {
    success: false,
    error: `Failed after ${maxRetries} attempts: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`,
  };
}

/**
 * Find station by socket number (charge point)
 * Uses Ampeco's charge-points endpoint
 */
export async function findStationBySocketNumber(
  socketNumber: string
): Promise<{ success: boolean; station?: any; evse?: any; error?: string }> {
  try {
    // Search for station by socket number using Ampeco's public API
    const result = await ampecoRequest<any>('/public-api/resources/charge-points/v1.0', {
      method: 'GET',
    });

    if (!result.success || !result.data) {
      return { success: false, error: 'Failed to fetch charge points' };
    }

    // Find charge point with matching ID or network ID
    for (const chargePoint of result.data.data || []) {
      // Check if the charge point ID or networkId matches
      if (chargePoint.id === socketNumber || 
          chargePoint.networkId === socketNumber ||
          chargePoint.name === socketNumber) {
        // Return first EVSE if available
        const evse = chargePoint.evses?.[0];
        return { success: true, station: chargePoint, evse };
      }
      
      // Also check within EVSEs
      for (const evse of chargePoint.evses || []) {
        if (evse.id === socketNumber || 
            evse.networkId === socketNumber ||
            evse.physicalReference === socketNumber) {
          return { success: true, station: chargePoint, evse };
        }
      }
    }

    return { success: false, error: `Charge point with identifier ${socketNumber} not found` };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get charge point status
 */
export async function getStationStatus(stationId: string) {
  return ampecoRequest(`/public-api/resources/charge-points/v1.0/${stationId}`, {
    method: 'GET',
    useCache: true,
    cacheTTL: 60, // 1 minute cache for real-time status
  });
}

/**
 * Reset charge point
 */
export async function resetStation(stationId: string, resetType: 'soft' | 'hard' = 'soft') {
  return ampecoRequest(`/public-api/actions/charge-point/v1.0/${stationId}/reset`, {
    method: 'POST',
    body: { type: resetType },
    useCache: false,
  });
}

/**
 * Unlock connector on charge point
 */
export async function unlockConnector(chargePointId: string, connectorId: string) {
  return ampecoRequest(`/public-api/actions/charge-point/v1.0/${chargePointId}/unlock-connector`, {
    method: 'POST',
    body: { connectorId },
    useCache: false,
  });
}

/**
 * Get active charging sessions
 * Note: Ampeco's sessions endpoint returns all sessions
 */
export async function getActiveSession(chargePointId?: string) {
  const params = new URLSearchParams();
  params.append('status', 'active,charging'); // Filter for active sessions only
  
  const queryString = params.toString();
  const result = await ampecoRequest<any>(`/public-api/resources/sessions/v1.0?${queryString}`, {
    method: 'GET',
    useCache: true,
    cacheTTL: 30, // 30 seconds cache
  });

  if (!result.success || !chargePointId) {
    return result;
  }

  // Filter to get sessions for specific charge point
  if (result.data?.data) {
    const filteredData = result.data.data.filter(
      (session: any) => session.chargePointId === parseInt(chargePointId)
    );
    return { ...result, data: { ...result.data, data: filteredData } };
  }

  return result;
}

/**
 * Get session history
 */
export async function getSessionHistory(userId?: string, limit: number = 10) {
  const params = new URLSearchParams();
  if (userId) params.append('userId', userId);
  params.append('limit', limit.toString());
  
  const queryString = params.toString();
  return ampecoRequest(`/public-api/resources/sessions/v1.0?${queryString}`, {
    method: 'GET',
    useCache: true,
    cacheTTL: 300, // 5 minutes cache
  });
}

/**
 * Get tariff information
 */
export async function getTariffInfo(tariffId?: string) {
  const endpoint = tariffId 
    ? `/public-api/resources/tariffs/v1.0/${tariffId}`
    : '/public-api/resources/tariffs/v1.0';
  
  return ampecoRequest(endpoint, {
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

/**
 * Session timeout management
 */
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const sessionActivityStore = new Map<string, number>();

export function updateSessionActivity(threadId: string): void {
  sessionActivityStore.set(threadId, Date.now());
}

export function isSessionExpired(threadId: string): boolean {
  const lastActivity = sessionActivityStore.get(threadId);
  if (!lastActivity) return true;
  
  const now = Date.now();
  const isExpired = (now - lastActivity) > SESSION_TIMEOUT;
  
  if (isExpired) {
    logger.debug({ threadId }, 'Session expired');
    sessionActivityStore.delete(threadId);
  }
  
  return isExpired;
}

export function clearExpiredSessions(): void {
  const now = Date.now();
  let clearedCount = 0;
  
  for (const [threadId, lastActivity] of sessionActivityStore.entries()) {
    if ((now - lastActivity) > SESSION_TIMEOUT) {
      sessionActivityStore.delete(threadId);
      clearedCount++;
    }
  }
  
  if (clearedCount > 0) {
    logger.info({ clearedCount }, 'Cleared expired sessions');
  }
}

// Run cleanup every 5 minutes
setInterval(clearExpiredSessions, 5 * 60 * 1000);
