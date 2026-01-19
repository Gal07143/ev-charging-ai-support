/**
 * Dynamic API Service
 * OpenAPI specification loader, parser, and dynamic Mastra tool generator
 * 
 * Features:
 * - Load OpenAPI specifications from URLs or JSON
 * - Parse OpenAPI 3.x specifications
 * - Auto-generate Mastra tools from API endpoints
 * - Monitor API health and rate limits
 * - Manual fallback strategies for failed API calls
 * - Version control and change detection
 */

import type { D1Database } from '@cloudflare/workers-types';

// ============================================================================
// Types
// ============================================================================

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: {
    [path: string]: {
      [method: string]: {
        operationId?: string;
        summary?: string;
        description?: string;
        parameters?: any[];
        requestBody?: any;
        responses?: any;
        security?: any[];
      };
    };
  };
  components?: {
    securitySchemes?: any;
    schemas?: any;
  };
}

export interface APISpecification {
  id?: number;
  api_name: string;
  display_name: string;
  description?: string;
  openapi_version: string;
  spec_url?: string;
  spec_content: string;
  spec_hash: string;
  spec_version?: string;
  base_url: string;
  auth_type: 'bearer' | 'api_key' | 'oauth2' | 'basic' | 'none';
  auth_config?: string;
  status: 'active' | 'disabled' | 'deprecated' | 'error';
  health_status?: 'healthy' | 'degraded' | 'down' | 'unknown';
  rate_limit_per_minute?: number;
  rate_limit_per_hour?: number;
  rate_limit_per_day?: number;
  created_at?: string;
  updated_at?: string;
}

export interface APIEndpoint {
  id?: number;
  api_id: number;
  operation_id: string;
  path: string;
  method: string;
  summary?: string;
  description?: string;
  parameters_schema?: string;
  request_body_schema?: string;
  response_schema?: string;
  error_schemas?: string;
  mastra_tool_name?: string;
  tool_description?: string;
  tool_config?: string;
  is_enabled: boolean;
  requires_auth: boolean;
}

export interface APIRequestLog {
  api_id: number;
  endpoint_id?: number;
  conversation_id?: string;
  user_id?: string;
  agent_id: string;
  method: string;
  endpoint: string;
  request_headers?: string;
  request_body?: string;
  status_code?: number;
  response_headers?: string;
  response_body?: string;
  response_time_ms?: number;
  error_message?: string;
  is_fallback: boolean;
  retry_count: number;
}

// ============================================================================
// Dynamic API Service
// ============================================================================

export class DynamicAPIService {
  constructor(private db: D1Database) {}

  /**
   * Load and register an API from OpenAPI specification URL
   */
  async loadAPIFromURL(
    apiName: string,
    specUrl: string,
    authConfig?: { type: string; credentials: any }
  ): Promise<APISpecification> {
    try {
      // Fetch OpenAPI spec
      const response = await fetch(specUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch OpenAPI spec: ${response.statusText}`);
      }
      
      const spec: OpenAPISpec = await response.json();
      
      // Register API
      return await this.registerAPI(apiName, spec, specUrl, authConfig);
    } catch (error: any) {
      throw new Error(`Failed to load API from URL: ${error.message}`);
    }
  }

  /**
   * Register an API from OpenAPI specification object
   */
  async registerAPI(
    apiName: string,
    spec: OpenAPISpec,
    specUrl?: string,
    authConfig?: { type: string; credentials: any }
  ): Promise<APISpecification> {
    try {
      // Extract base URL
      const baseUrl = spec.servers?.[0]?.url || '';
      
      // Determine auth type
      const authType = authConfig?.type || this.detectAuthType(spec);
      
      // Generate spec hash for change detection
      const specContent = JSON.stringify(spec);
      const specHash = await this.generateHash(specContent);
      
      // Check if API already exists
      const existing = await this.db
        .prepare('SELECT id, spec_hash FROM api_specifications WHERE api_name = ?')
        .bind(apiName)
        .first<{ id: number; spec_hash: string }>();
      
      let apiId: number;
      
      if (existing) {
        // Check if spec changed
        if (existing.spec_hash === specHash) {
          console.log(`API ${apiName} already registered with same spec`);
          return await this.getAPISpecification(apiName);
        }
        
        // Update existing API
        await this.db
          .prepare(`
            UPDATE api_specifications 
            SET spec_content = ?,
                spec_hash = ?,
                spec_version = ?,
                base_url = ?,
                auth_type = ?,
                auth_config = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE api_name = ?
          `)
          .bind(
            specContent,
            specHash,
            spec.info.version,
            baseUrl,
            authType,
            authConfig ? JSON.stringify(authConfig.credentials) : null,
            apiName
          )
          .run();
        
        apiId = existing.id;
      } else {
        // Insert new API
        const result = await this.db
          .prepare(`
            INSERT INTO api_specifications (
              api_name, display_name, description,
              openapi_version, spec_url, spec_content, spec_hash, spec_version,
              base_url, auth_type, auth_config, status, is_auto_generated
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1)
          `)
          .bind(
            apiName,
            spec.info.title,
            spec.info.description || '',
            spec.openapi,
            specUrl || null,
            specContent,
            specHash,
            spec.info.version,
            baseUrl,
            authType,
            authConfig ? JSON.stringify(authConfig.credentials) : null
          )
          .run();
        
        apiId = result.meta.last_row_id as number;
      }
      
      // Parse and register endpoints
      await this.parseEndpoints(apiId, spec);
      
      return await this.getAPISpecification(apiName);
    } catch (error: any) {
      throw new Error(`Failed to register API: ${error.message}`);
    }
  }

  /**
   * Parse OpenAPI endpoints and register them
   */
  private async parseEndpoints(apiId: number, spec: OpenAPISpec): Promise<void> {
    const endpoints: APIEndpoint[] = [];
    
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
          const operationId = operation.operationId || `${method}_${path.replace(/\//g, '_')}`;
          
          const endpoint: APIEndpoint = {
            api_id: apiId,
            operation_id: operationId,
            path,
            method: method.toUpperCase(),
            summary: operation.summary,
            description: operation.description,
            parameters_schema: operation.parameters ? JSON.stringify(operation.parameters) : undefined,
            request_body_schema: operation.requestBody ? JSON.stringify(operation.requestBody) : undefined,
            response_schema: operation.responses ? JSON.stringify(operation.responses['200']) : undefined,
            error_schemas: operation.responses ? JSON.stringify(this.extractErrorSchemas(operation.responses)) : undefined,
            mastra_tool_name: this.generateToolName(operationId),
            tool_description: operation.summary || operation.description || `Call ${operationId}`,
            tool_config: JSON.stringify(this.generateToolConfig(operationId, operation)),
            is_enabled: true,
            requires_auth: !!operation.security || false
          };
          
          endpoints.push(endpoint);
        }
      }
    }
    
    // Batch insert endpoints
    for (const endpoint of endpoints) {
      await this.db
        .prepare(`
          INSERT OR REPLACE INTO api_endpoints (
            api_id, operation_id, path, method, summary, description,
            parameters_schema, request_body_schema, response_schema, error_schemas,
            mastra_tool_name, tool_description, tool_config,
            is_enabled, requires_auth
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          endpoint.api_id,
          endpoint.operation_id,
          endpoint.path,
          endpoint.method,
          endpoint.summary,
          endpoint.description,
          endpoint.parameters_schema,
          endpoint.request_body_schema,
          endpoint.response_schema,
          endpoint.error_schemas,
          endpoint.mastra_tool_name,
          endpoint.tool_description,
          endpoint.tool_config,
          endpoint.is_enabled ? 1 : 0,
          endpoint.requires_auth ? 1 : 0
        )
        .run();
    }
  }

  /**
   * Make an API call using registered API and endpoint
   */
  async callAPI(
    apiName: string,
    operationId: string,
    parameters?: any,
    requestBody?: any,
    context?: { conversation_id?: string; user_id?: string }
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Get API specification
      const api = await this.getAPISpecification(apiName);
      if (!api || api.status !== 'active') {
        throw new Error(`API ${apiName} not found or not active`);
      }
      
      // Get endpoint
      const endpoint = await this.db
        .prepare('SELECT * FROM api_endpoints WHERE api_id = ? AND operation_id = ? AND is_enabled = 1')
        .bind(api.id, operationId)
        .first<APIEndpoint>();
      
      if (!endpoint) {
        throw new Error(`Endpoint ${operationId} not found or not enabled`);
      }
      
      // Check rate limits
      await this.checkRateLimit(api.id!);
      
      // Build request
      const url = this.buildURL(api.base_url, endpoint.path, parameters);
      const headers = await this.buildHeaders(api);
      const body = requestBody ? JSON.stringify(requestBody) : undefined;
      
      // Make request
      const response = await fetch(url, {
        method: endpoint.method,
        headers,
        body
      });
      
      const responseTime = Date.now() - startTime;
      const responseBody = await response.text();
      
      // Log request
      await this.logAPIRequest({
        api_id: api.id!,
        endpoint_id: endpoint.id,
        conversation_id: context?.conversation_id,
        user_id: context?.user_id,
        agent_id: 'edge_control_agent',
        method: endpoint.method,
        endpoint: url,
        request_headers: JSON.stringify(Object.fromEntries(headers.entries())),
        request_body: body,
        status_code: response.status,
        response_headers: JSON.stringify(Object.fromEntries(response.headers.entries())),
        response_body: responseBody,
        response_time_ms: responseTime,
        is_fallback: false,
        retry_count: 0
      });
      
      // Update rate limits
      await this.updateRateLimit(api.id!);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${responseBody}`);
      }
      
      return JSON.parse(responseBody);
    } catch (error: any) {
      // Try fallback if available
      const fallbackResult = await this.tryFallback(apiName, operationId, parameters, requestBody, error);
      if (fallbackResult) {
        return fallbackResult;
      }
      
      throw error;
    }
  }

  /**
   * Get API specification by name
   */
  async getAPISpecification(apiName: string): Promise<APISpecification> {
    const result = await this.db
      .prepare('SELECT * FROM api_specifications WHERE api_name = ?')
      .bind(apiName)
      .first<APISpecification>();
    
    if (!result) {
      throw new Error(`API ${apiName} not found`);
    }
    
    return result;
  }

  /**
   * Get all active APIs
   */
  async getActiveAPIs(): Promise<APISpecification[]> {
    const result = await this.db
      .prepare('SELECT * FROM v_active_apis ORDER BY display_name')
      .all<APISpecification>();
    
    return result.results || [];
  }

  /**
   * Get API endpoints
   */
  async getAPIEndpoints(apiName: string): Promise<APIEndpoint[]> {
    const api = await this.getAPISpecification(apiName);
    
    const result = await this.db
      .prepare('SELECT * FROM api_endpoints WHERE api_id = ? ORDER BY path, method')
      .bind(api.id)
      .all<APIEndpoint>();
    
    return result.results || [];
  }

  /**
   * Get API performance metrics
   */
  async getAPIPerformance(apiName?: string): Promise<any[]> {
    let query = 'SELECT * FROM v_api_performance';
    const bindings: any[] = [];
    
    if (apiName) {
      query += ' WHERE api_name = ?';
      bindings.push(apiName);
    }
    
    query += ' ORDER BY total_requests DESC';
    
    const result = await this.db
      .prepare(query)
      .bind(...bindings)
      .all();
    
    return result.results || [];
  }

  /**
   * Check API health
   */
  async checkAPIHealth(apiName: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      const api = await this.getAPISpecification(apiName);
      
      // Simple ping to base URL
      const response = await fetch(api.base_url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      const responseTime = Date.now() - startTime;
      
      // Calculate success rate for last hour
      const statsResult = await this.db
        .prepare(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as success
          FROM api_request_logs
          WHERE api_id = ? AND created_at > datetime('now', '-1 hour')
        `)
        .bind(api.id)
        .first<{ total: number; success: number }>();
      
      const successRate = statsResult && statsResult.total > 0
        ? statsResult.success / statsResult.total
        : null;
      
      const status = response.ok ? 'healthy' : 'degraded';
      
      // Log health check
      await this.db
        .prepare(`
          INSERT INTO api_health_checks (
            api_id, status, response_time_ms, success_rate_1h, request_count_1h
          ) VALUES (?, ?, ?, ?, ?)
        `)
        .bind(
          api.id,
          status,
          responseTime,
          successRate,
          statsResult?.total || 0
        )
        .run();
      
      // Update API health status
      await this.db
        .prepare('UPDATE api_specifications SET health_status = ?, last_health_check = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(status, api.id)
        .run();
    } catch (error: any) {
      // Log failed health check
      const api = await this.getAPISpecification(apiName);
      
      await this.db
        .prepare(`
          INSERT INTO api_health_checks (
            api_id, status, error_message
          ) VALUES (?, 'down', ?)
        `)
        .bind(api.id, error.message)
        .run();
      
      // Update API health status
      await this.db
        .prepare('UPDATE api_specifications SET health_status = \'down\', last_health_check = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(api.id)
        .run();
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private detectAuthType(spec: OpenAPISpec): string {
    if (!spec.components?.securitySchemes) {
      return 'none';
    }
    
    const schemes = Object.values(spec.components.securitySchemes);
    if (schemes.length === 0) return 'none';
    
    const firstScheme: any = schemes[0];
    if (firstScheme.type === 'http') {
      return firstScheme.scheme === 'bearer' ? 'bearer' : 'basic';
    } else if (firstScheme.type === 'apiKey') {
      return 'api_key';
    } else if (firstScheme.type === 'oauth2') {
      return 'oauth2';
    }
    
    return 'none';
  }

  private async generateHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private extractErrorSchemas(responses: any): any {
    const errorSchemas: any = {};
    for (const [code, response] of Object.entries(responses)) {
      if (parseInt(code) >= 400) {
        errorSchemas[code] = response;
      }
    }
    return errorSchemas;
  }

  private generateToolName(operationId: string): string {
    return operationId
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase();
  }

  private generateToolConfig(operationId: string, operation: any): any {
    return {
      operation_id: operationId,
      name: this.generateToolName(operationId),
      description: operation.summary || operation.description || `Call ${operationId}`,
      parameters: operation.parameters || [],
      requestBody: operation.requestBody,
      responses: operation.responses
    };
  }

  private buildURL(baseUrl: string, path: string, parameters?: any): string {
    let url = baseUrl + path;
    
    if (parameters) {
      // Replace path parameters
      for (const [key, value] of Object.entries(parameters)) {
        url = url.replace(`{${key}}`, String(value));
      }
      
      // Add query parameters
      const queryParams = new URLSearchParams();
      for (const [key, value] of Object.entries(parameters)) {
        if (!url.includes(`{${key}}`)) {
          queryParams.append(key, String(value));
        }
      }
      
      const queryString = queryParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }
    
    return url;
  }

  private async buildHeaders(api: APISpecification): Promise<Headers> {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'User-Agent': 'EdgeControl-AI-Agent/1.0'
    });
    
    if (api.auth_config) {
      const authConfig = JSON.parse(api.auth_config);
      
      if (api.auth_type === 'bearer') {
        headers.set('Authorization', `Bearer ${authConfig.token}`);
      } else if (api.auth_type === 'api_key') {
        if (authConfig.in === 'header') {
          headers.set(authConfig.name, authConfig.value);
        }
      } else if (api.auth_type === 'basic') {
        const encoded = btoa(`${authConfig.username}:${authConfig.password}`);
        headers.set('Authorization', `Basic ${encoded}`);
      }
    }
    
    return headers;
  }

  private async checkRateLimit(apiId: number): Promise<void> {
    // Check current rate limits for minute, hour, day
    const windows = ['minute', 'hour', 'day'];
    
    for (const windowType of windows) {
      const result = await this.db
        .prepare(`
          SELECT request_count, limit_exceeded
          FROM api_rate_limits
          WHERE api_id = ? 
            AND window_type = ?
            AND window_end > datetime('now')
          ORDER BY window_start DESC
          LIMIT 1
        `)
        .bind(apiId, windowType)
        .first<{ request_count: number; limit_exceeded: number }>();
      
      if (result?.limit_exceeded) {
        throw new Error(`Rate limit exceeded for ${windowType} window`);
      }
    }
  }

  private async updateRateLimit(apiId: number): Promise<void> {
    const windows = [
      { type: 'minute', duration: '1 minute' },
      { type: 'hour', duration: '1 hour' },
      { type: 'day', duration: '1 day' }
    ];
    
    for (const window of windows) {
      const now = new Date().toISOString();
      
      await this.db
        .prepare(`
          INSERT INTO api_rate_limits (
            api_id, window_start, window_end, window_type, request_count
          ) 
          VALUES (?, datetime('now'), datetime('now', '+' || ?), ?, 1)
          ON CONFLICT (api_id, window_type, window_start) 
          DO UPDATE SET 
            request_count = request_count + 1,
            updated_at = CURRENT_TIMESTAMP
        `)
        .bind(apiId, window.duration, window.type)
        .run();
    }
  }

  private async tryFallback(
    apiName: string,
    operationId: string,
    parameters?: any,
    requestBody?: any,
    error?: Error
  ): Promise<any | null> {
    try {
      const api = await this.getAPISpecification(apiName);
      const endpoint = await this.db
        .prepare('SELECT id FROM api_endpoints WHERE api_id = ? AND operation_id = ?')
        .bind(api.id, operationId)
        .first<{ id: number }>();
      
      if (!endpoint) return null;
      
      // Get fallback configurations
      const fallbacks = await this.db
        .prepare(`
          SELECT * FROM api_fallback_configs
          WHERE (api_id = ? OR endpoint_id = ?)
            AND is_enabled = 1
          ORDER BY priority DESC
        `)
        .bind(api.id, endpoint.id)
        .all<any>();
      
      for (const fallback of fallbacks.results || []) {
        const config = JSON.parse(fallback.fallback_config);
        
        if (fallback.fallback_type === 'static_response') {
          // Return static response
          return config.response;
        } else if (fallback.fallback_type === 'alternate_api') {
          // Try alternate API
          return await this.callAPI(
            config.alternate_api,
            config.alternate_operation,
            parameters,
            requestBody
          );
        } else if (fallback.fallback_type === 'manual_step') {
          // Return manual step instructions
          return {
            requires_manual_intervention: true,
            instructions: config.instructions,
            contact: config.contact
          };
        }
      }
    } catch (fallbackError) {
      console.error('Fallback failed:', fallbackError);
    }
    
    return null;
  }

  private async logAPIRequest(log: APIRequestLog): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO api_request_logs (
          api_id, endpoint_id, conversation_id, user_id, agent_id,
          method, endpoint, request_headers, request_body,
          status_code, response_headers, response_body, response_time_ms,
          error_message, is_fallback, retry_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        log.api_id,
        log.endpoint_id,
        log.conversation_id,
        log.user_id,
        log.agent_id,
        log.method,
        log.endpoint,
        log.request_headers,
        log.request_body,
        log.status_code,
        log.response_headers,
        log.response_body,
        log.response_time_ms,
        log.error_message,
        log.is_fallback ? 1 : 0,
        log.retry_count
      )
      .run();
  }
}
