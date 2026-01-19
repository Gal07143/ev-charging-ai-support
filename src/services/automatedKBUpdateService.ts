/**
 * Automated KB Update Service
 * Web scraping, change detection, and KB content management
 * 
 * Features:
 * - Web scraping for documentation sources
 * - Change detection with hashing
 * - Content parsing (HTML/text)
 * - Human review queue
 * - Automatic KB updates
 */

import type { D1Database } from '@cloudflare/workers-types';

// ============================================================================
// Types
// ============================================================================

export interface DocSource {
  id?: number;
  source_name: string;
  source_type: 'website' | 'pdf' | 'api_endpoint';
  url: string;
  parser_type: 'html' | 'pdf' | 'markdown' | 'json';
  check_frequency_hours: number;
  is_active: boolean;
}

export interface DocChange {
  source_id: number;
  change_type: 'content_updated' | 'new_section' | 'removed_section';
  previous_hash?: string;
  new_hash: string;
  previous_content?: string;
  new_content: string;
  diff_summary: string;
  impact_score: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface ReviewTask {
  change_id: number;
  priority: number;
  task_type: 'approve_change' | 'update_article' | 'create_article';
  task_description: string;
  suggested_action?: any;
}

// ============================================================================
// Automated KB Update Service
// ============================================================================

export class AutomatedKBUpdateService {
  constructor(private db: D1Database) {}

  /**
   * Check a documentation source for changes
   */
  async checkDocSource(sourceId: number): Promise<{ changed: boolean; changeId?: number }> {
    const startTime = Date.now();
    
    // Get source details
    const source = await this.db
      .prepare('SELECT * FROM kb_doc_sources WHERE id = ? AND is_active = 1')
      .bind(sourceId)
      .first<any>();
    
    if (!source) {
      throw new Error(`Source ${sourceId} not found or inactive`);
    }
    
    try {
      // Fetch content
      const content = await this.fetchContent(source.url, source.parser_type);
      const newHash = await this.generateHash(content);
      
      const fetchTime = Date.now() - startTime;
      
      // Check if changed
      const changed = source.content_hash !== newHash;
      
      // Log scraping
      await this.logScraping(sourceId, 'success', newHash, content.length, fetchTime, changed);
      
      if (!changed) {
        // Update last checked
        await this.updateSourceLastChecked(sourceId, newHash);
        return { changed: false };
      }
      
      // Content changed - detect and queue for review
      const changeId = await this.detectAndQueueChange(
        sourceId,
        source.content_hash,
        newHash,
        source.url,
        content
      );
      
      // Update source
      await this.updateSourceLastChecked(sourceId, newHash);
      
      return { changed: true, changeId };
    } catch (error: any) {
      // Log error
      await this.logScraping(sourceId, 'error', null, 0, Date.now() - startTime, false, error.message);
      
      // Update source with error
      await this.db
        .prepare(`
          UPDATE kb_doc_sources
          SET last_error = ?,
              status = 'error',
              last_checked_at = CURRENT_TIMESTAMP,
              next_check_at = datetime('now', '+' || check_frequency_hours || ' hours'),
              total_checks = total_checks + 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .bind(error.message, sourceId)
        .run();
      
      throw error;
    }
  }

  /**
   * Fetch content from URL
   */
  private async fetchContent(url: string, parserType: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'EdgeControl-KB-Bot/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const rawContent = await response.text();
    
    // Parse based on type
    if (parserType === 'html') {
      return this.parseHTML(rawContent);
    } else if (parserType === 'markdown') {
      return rawContent;
    } else {
      return rawContent;
    }
  }

  /**
   * Parse HTML to extract main content
   */
  private parseHTML(html: string): string {
    // Simple extraction - remove scripts, styles, and get text
    let content = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return content;
  }

  /**
   * Detect change and queue for review
   */
  private async detectAndQueueChange(
    sourceId: number,
    previousHash: string | null,
    newHash: string,
    sourceUrl: string,
    newContent: string
  ): Promise<number> {
    // Get previous content if exists
    const previousContent = previousHash
      ? await this.getContentByHash(sourceId, previousHash)
      : null;
    
    // Determine change type
    const changeType = !previousHash ? 'new_section' : 'content_updated';
    
    // Calculate diff summary
    const diffSummary = this.generateDiffSummary(previousContent, newContent);
    
    // Calculate impact score (simple heuristic)
    const impactScore = this.calculateImpactScore(previousContent, newContent, sourceUrl);
    
    // Determine urgency
    const urgency = this.determineUrgency(impactScore, changeType);
    
    // Insert change
    const changeResult = await this.db
      .prepare(`
        INSERT INTO kb_doc_changes (
          source_id, change_type, previous_hash, new_hash,
          previous_content, new_content, diff_summary,
          impact_score, urgency, review_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `)
      .bind(
        sourceId,
        changeType,
        previousHash,
        newHash,
        previousContent || null,
        newContent,
        diffSummary,
        impactScore,
        urgency
      )
      .run();
    
    const changeId = changeResult.meta.last_row_id as number;
    
    // Queue for review if high impact
    if (impactScore > 0.5) {
      await this.queueForReview(changeId, impactScore, urgency, diffSummary);
    }
    
    return changeId;
  }

  /**
   * Queue change for human review
   */
  private async queueForReview(
    changeId: number,
    impactScore: number,
    urgency: string,
    diffSummary: string
  ): Promise<void> {
    // Calculate priority (1-10 scale)
    let priority = 5;
    if (urgency === 'critical') priority = 10;
    else if (urgency === 'high') priority = 8;
    else if (urgency === 'medium') priority = 5;
    else priority = 3;
    
    await this.db
      .prepare(`
        INSERT INTO kb_review_queue (
          change_id, priority, task_type, task_description, status
        ) VALUES (?, ?, 'approve_change', ?, 'pending')
      `)
      .bind(
        changeId,
        priority,
        `Review documentation change: ${diffSummary}`
      )
      .run();
  }

  /**
   * Get all sources due for checking
   */
  async getSourcesDueForCheck(): Promise<any[]> {
    const result = await this.db
      .prepare('SELECT * FROM v_kb_sources_due_for_check LIMIT 50')
      .all();
    
    return result.results || [];
  }

  /**
   * Get pending reviews
   */
  async getPendingReviews(limit: number = 20): Promise<any[]> {
    const result = await this.db
      .prepare('SELECT * FROM v_kb_pending_reviews LIMIT ?')
      .bind(limit)
      .all();
    
    return result.results || [];
  }

  /**
   * Approve change and update KB
   */
  async approveChange(
    changeId: number,
    reviewerId: string,
    notes?: string
  ): Promise<void> {
    // Update change status
    await this.db
      .prepare(`
        UPDATE kb_doc_changes
        SET review_status = 'approved',
            reviewed_by = ?,
            reviewed_at = CURRENT_TIMESTAMP,
            review_notes = ?
        WHERE id = ?
      `)
      .bind(reviewerId, notes || null, changeId)
      .run();
    
    // Update review queue
    await this.db
      .prepare(`
        UPDATE kb_review_queue
        SET status = 'completed',
            action_taken = 'approved',
            reviewer_notes = ?,
            completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE change_id = ? AND status = 'pending'
      `)
      .bind(notes || null, changeId)
      .run();
  }

  /**
   * Reject change
   */
  async rejectChange(
    changeId: number,
    reviewerId: string,
    reason: string
  ): Promise<void> {
    await this.db
      .prepare(`
        UPDATE kb_doc_changes
        SET review_status = 'rejected',
            reviewed_by = ?,
            reviewed_at = CURRENT_TIMESTAMP,
            review_notes = ?
        WHERE id = ?
      `)
      .bind(reviewerId, reason, changeId)
      .run();
    
    await this.db
      .prepare(`
        UPDATE kb_review_queue
        SET status = 'completed',
            action_taken = 'rejected',
            reviewer_notes = ?,
            completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE change_id = ? AND status = 'pending'
      `)
      .bind(reason, changeId)
      .run();
  }

  /**
   * Get scraping health status
   */
  async getScrapingHealth(): Promise<any[]> {
    const result = await this.db
      .prepare('SELECT * FROM v_kb_scraping_health')
      .all();
    
    return result.results || [];
  }

  /**
   * Get recent KB changes
   */
  async getRecentChanges(days: number = 7): Promise<any[]> {
    const result = await this.db
      .prepare('SELECT * FROM v_kb_recent_changes LIMIT 100')
      .all();
    
    return result.results || [];
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async generateHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private generateDiffSummary(oldContent: string | null, newContent: string): string {
    if (!oldContent) {
      return 'New documentation added';
    }
    
    const oldLength = oldContent.length;
    const newLength = newContent.length;
    const diff = newLength - oldLength;
    const percentChange = Math.abs(diff) / oldLength * 100;
    
    if (percentChange < 5) {
      return 'Minor updates';
    } else if (percentChange < 20) {
      return 'Moderate content changes';
    } else {
      return 'Major documentation update';
    }
  }

  private calculateImpactScore(
    oldContent: string | null,
    newContent: string,
    sourceUrl: string
  ): number {
    if (!oldContent) return 0.5; // New content = medium impact
    
    const oldLength = oldContent.length;
    const newLength = newContent.length;
    const percentChange = Math.abs(newLength - oldLength) / oldLength * 100;
    
    // Base score on content change percentage
    let score = Math.min(percentChange / 50, 1.0); // Max at 50% change
    
    // Boost for critical keywords
    const criticalKeywords = ['error', 'bug', 'issue', 'update', 'change', 'new', 'deprecated'];
    const keywordMatches = criticalKeywords.filter(kw =>
      newContent.toLowerCase().includes(kw)
    ).length;
    
    score += keywordMatches * 0.1;
    
    return Math.min(score, 1.0);
  }

  private determineUrgency(impactScore: number, changeType: string): 'low' | 'medium' | 'high' | 'critical' {
    if (changeType === 'removed_section') return 'high';
    
    if (impactScore > 0.8) return 'critical';
    if (impactScore > 0.6) return 'high';
    if (impactScore > 0.3) return 'medium';
    return 'low';
  }

  private async getContentByHash(sourceId: number, hash: string): Promise<string | null> {
    const result = await this.db
      .prepare('SELECT previous_content FROM kb_doc_changes WHERE source_id = ? AND previous_hash = ? LIMIT 1')
      .bind(sourceId, hash)
      .first<{ previous_content: string }>();
    
    return result?.previous_content || null;
  }

  private async updateSourceLastChecked(sourceId: number, newHash: string): Promise<void> {
    await this.db
      .prepare(`
        UPDATE kb_doc_sources
        SET last_checked_at = CURRENT_TIMESTAMP,
            next_check_at = datetime('now', '+' || check_frequency_hours || ' hours'),
            content_hash = ?,
            total_checks = total_checks + 1,
            successful_checks = successful_checks + 1,
            last_error = NULL,
            status = 'active',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(newHash, sourceId)
      .run();
  }

  private async logScraping(
    sourceId: number,
    status: string,
    contentHash: string | null,
    contentSize: number,
    fetchTimeMs: number,
    changesDetected: boolean,
    errorMessage?: string
  ): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO kb_scraping_logs (
          source_id, status, content_hash, content_size,
          fetch_time_ms, changes_detected, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        sourceId,
        status,
        contentHash,
        contentSize,
        fetchTimeMs,
        changesDetected ? 1 : 0,
        errorMessage || null
      )
      .run();
  }

  /**
   * Aggregate daily analytics
   */
  async aggregateDailyAnalytics(date: string): Promise<void> {
    await this.db
      .prepare(`
        INSERT OR REPLACE INTO kb_update_analytics_daily (
          date, total_checks, successful_checks, failed_checks,
          total_changes, pending_review, reviews_completed
        )
        SELECT 
          DATE(scraped_at) as date,
          COUNT(*) as total_checks,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_checks,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed_checks,
          SUM(CASE WHEN changes_detected = 1 THEN 1 ELSE 0 END) as total_changes,
          (SELECT COUNT(*) FROM kb_review_queue WHERE status = 'pending') as pending_review,
          (SELECT COUNT(*) FROM kb_review_queue WHERE status = 'completed' AND DATE(completed_at) = ?) as reviews_completed
        FROM kb_scraping_logs
        WHERE DATE(scraped_at) = ?
        GROUP BY DATE(scraped_at)
      `)
      .bind(date, date)
      .run();
  }
}
