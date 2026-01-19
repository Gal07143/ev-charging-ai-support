/**
 * ID Generator Utility
 * Generate unique IDs for escalation tickets and other entities
 */

/**
 * Generate a short unique ID (8 characters)
 * Format: BASE36 encoding of timestamp + random
 * Example: A7K9M2X1
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return (timestamp + random).substring(0, 8);
}

/**
 * Generate a longer unique ID (16 characters)
 * For entities that need higher uniqueness
 */
export function generateLongId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return (timestamp + random).padEnd(16, '0');
}

/**
 * Generate a UUID v4
 * For maximum uniqueness requirements
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
