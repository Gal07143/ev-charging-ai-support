/**
 * Dynamic API Tools
 * Mastra tools for loading, managing, and calling dynamic APIs
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import type { D1Database } from '@cloudflare/workers-types';
import { DynamicAPIService } from '../../services/dynamicAPIService';

// ============================================================================
// Tool 1: Load API from OpenAPI Specification URL
// ============================================================================

export const loadAPIFromURLTool = createTool({
  id: 'load_api_from_url',
  name: 'Load API from OpenAPI Spec URL',
  description: 'Load and register a new API from an OpenAPI specification URL. This automatically parses the spec and creates callable tools for each endpoint.',
  inputSchema: z.object({
    api_name: z.string().describe('Internal name for the API (e.g., "stripe_api", "sendgrid_api")'),
    spec_url: z.string().url().describe('URL to the OpenAPI specification (JSON or YAML)'),
    auth_type: z.enum(['bearer', 'api_key', 'oauth2', 'basic', 'none']).optional().describe('Authentication type'),
    auth_credentials: z.record(z.any()).optional().describe('Authentication credentials (token, api key, etc.)')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    const service = new DynamicAPIService(db);
    
    const authConfig = input.auth_type && input.auth_credentials ? {
      type: input.auth_type,
      credentials: input.auth_credentials
    } : undefined;
    
    const api = await service.loadAPIFromURL(
      input.api_name,
      input.spec_url,
      authConfig
    );
    
    // Get registered endpoints
    const endpoints = await service.getAPIEndpoints(input.api_name);
    
    return {
      success: true,
      api: {
        name: api.api_name,
        display_name: api.display_name,
        version: api.spec_version,
        base_url: api.base_url,
        endpoints_count: endpoints.length
      },
      endpoints: endpoints.map(e => ({
        operation_id: e.operation_id,
        method: e.method,
        path: e.path,
        summary: e.summary,
        tool_name: e.mastra_tool_name
      })),
      message: `Successfully loaded API "${api.display_name}" with ${endpoints.length} endpoints`
    };
  }
});

// ============================================================================
// Tool 2: Call Dynamic API Endpoint
// ============================================================================

export const callDynamicAPITool = createTool({
  id: 'call_dynamic_api',
  name: 'Call Dynamic API Endpoint',
  description: 'Make a call to a dynamically registered API endpoint using its operation ID.',
  inputSchema: z.object({
    api_name: z.string().describe('API name (e.g., "stripe_api")'),
    operation_id: z.string().describe('OpenAPI operation ID or endpoint identifier'),
    parameters: z.record(z.any()).optional().describe('Path and query parameters'),
    request_body: z.record(z.any()).optional().describe('Request body (for POST/PUT/PATCH)'),
    conversation_id: z.string().optional().describe('Current conversation ID for logging'),
    user_id: z.string().optional().describe('Current user ID for logging')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    const service = new DynamicAPIService(db);
    
    const result = await service.callAPI(
      input.api_name,
      input.operation_id,
      input.parameters,
      input.request_body,
      {
        conversation_id: input.conversation_id,
        user_id: input.user_id
      }
    );
    
    return {
      success: true,
      data: result,
      message: 'API call successful'
    };
  }
});

// ============================================================================
// Tool 3: Get Available APIs
// ============================================================================

export const getAvailableAPIsTool = createTool({
  id: 'get_available_apis',
  name: 'Get Available APIs',
  description: 'List all registered and active APIs that can be called dynamically.',
  inputSchema: z.object({
    include_health: z.boolean().optional().default(true).describe('Include health status information')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    const service = new DynamicAPIService(db);
    
    const apis = await service.getActiveAPIs();
    
    return {
      success: true,
      count: apis.length,
      apis: apis.map(api => ({
        name: api.api_name,
        display_name: api.display_name,
        description: api.description,
        version: api.spec_version,
        base_url: api.base_url,
        auth_type: api.auth_type,
        status: api.status,
        health_status: input.include_health ? api.health_status : undefined,
        last_health_check: input.include_health ? api.last_health_check : undefined,
        rate_limit_per_hour: api.rate_limit_per_hour
      }))
    };
  }
});

// ============================================================================
// Tool 4: Get API Endpoints
// ============================================================================

export const getAPIEndpointsTool = createTool({
  id: 'get_api_endpoints',
  name: 'Get API Endpoints',
  description: 'List all available endpoints for a specific API.',
  inputSchema: z.object({
    api_name: z.string().describe('API name to query'),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional().describe('Filter by HTTP method')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    const service = new DynamicAPIService(db);
    
    let endpoints = await service.getAPIEndpoints(input.api_name);
    
    if (input.method) {
      endpoints = endpoints.filter(e => e.method === input.method);
    }
    
    return {
      success: true,
      api_name: input.api_name,
      count: endpoints.length,
      endpoints: endpoints.map(e => ({
        operation_id: e.operation_id,
        method: e.method,
        path: e.path,
        summary: e.summary,
        description: e.description,
        tool_name: e.mastra_tool_name,
        requires_auth: e.requires_auth,
        is_enabled: e.is_enabled
      }))
    };
  }
});

// ============================================================================
// Tool 5: Check API Health
// ============================================================================

export const checkAPIHealthTool = createTool({
  id: 'check_api_health',
  name: 'Check API Health',
  description: 'Perform a health check on a registered API to verify it is responding correctly.',
  inputSchema: z.object({
    api_name: z.string().describe('API name to check')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    const service = new DynamicAPIService(db);
    
    await service.checkAPIHealth(input.api_name);
    
    // Get updated API info
    const api = await service.getAPISpecification(input.api_name);
    
    return {
      success: true,
      api_name: input.api_name,
      health_status: api.health_status,
      last_health_check: api.last_health_check,
      message: `Health check completed. Status: ${api.health_status}`
    };
  }
});

// ============================================================================
// Tool 6: Get API Performance Metrics
// ============================================================================

export const getAPIPerformanceTool = createTool({
  id: 'get_api_performance',
  name: 'Get API Performance Metrics',
  description: 'Get performance and usage statistics for APIs (last 24 hours).',
  inputSchema: z.object({
    api_name: z.string().optional().describe('Specific API name (optional - returns all if not specified)')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    const service = new DynamicAPIService(db);
    
    const metrics = await service.getAPIPerformance(input.api_name);
    
    return {
      success: true,
      time_range: 'Last 24 hours',
      count: metrics.length,
      metrics: metrics.map(m => ({
        api_name: m.api_name,
        display_name: m.display_name,
        total_requests: m.total_requests,
        success_count: m.success_count,
        error_count: m.error_count,
        success_rate: `${m.success_rate_percent}%`,
        avg_response_time_ms: m.avg_response_time_ms,
        min_response_time_ms: m.min_response_time_ms,
        max_response_time_ms: m.max_response_time_ms,
        fallback_count: m.fallback_count,
        last_used_at: m.last_used_at
      }))
    };
  }
});

// ============================================================================
// Tool 7: Enable/Disable API Endpoint
// ============================================================================

export const toggleAPIEndpointTool = createTool({
  id: 'toggle_api_endpoint',
  name: 'Enable/Disable API Endpoint',
  description: 'Enable or disable a specific API endpoint to control which operations can be called.',
  inputSchema: z.object({
    api_name: z.string().describe('API name'),
    operation_id: z.string().describe('Operation ID to toggle'),
    enabled: z.boolean().describe('true to enable, false to disable')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    const service = new DynamicAPIService(db);
    
    const api = await service.getAPISpecification(input.api_name);
    
    await db
      .prepare(`
        UPDATE api_endpoints 
        SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP
        WHERE api_id = ? AND operation_id = ?
      `)
      .bind(input.enabled ? 1 : 0, api.id, input.operation_id)
      .run();
    
    return {
      success: true,
      api_name: input.api_name,
      operation_id: input.operation_id,
      enabled: input.enabled,
      message: `Endpoint ${input.operation_id} ${input.enabled ? 'enabled' : 'disabled'} successfully`
    };
  }
});

// ============================================================================
// Tool 8: Add API Fallback Configuration
// ============================================================================

export const addAPIFallbackTool = createTool({
  id: 'add_api_fallback',
  name: 'Add API Fallback Configuration',
  description: 'Configure a fallback strategy for when an API call fails (static response, alternate API, or manual intervention).',
  inputSchema: z.object({
    api_name: z.string().describe('API name'),
    operation_id: z.string().optional().describe('Specific operation ID (optional - applies to all if not specified)'),
    fallback_type: z.enum(['static_response', 'alternate_api', 'manual_step']).describe('Type of fallback'),
    fallback_config: z.record(z.any()).describe('Fallback configuration (e.g., {response: {...}} for static_response)'),
    priority: z.number().optional().default(0).describe('Priority (higher = try first)')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    const service = new DynamicAPIService(db);
    
    const api = await service.getAPISpecification(input.api_name);
    
    let endpointId: number | null = null;
    if (input.operation_id) {
      const endpoint = await db
        .prepare('SELECT id FROM api_endpoints WHERE api_id = ? AND operation_id = ?')
        .bind(api.id, input.operation_id)
        .first<{ id: number }>();
      
      if (endpoint) {
        endpointId = endpoint.id;
      }
    }
    
    await db
      .prepare(`
        INSERT INTO api_fallback_configs (
          api_id, endpoint_id, fallback_type, fallback_config, priority, is_enabled
        ) VALUES (?, ?, ?, ?, ?, 1)
      `)
      .bind(
        api.id,
        endpointId,
        input.fallback_type,
        JSON.stringify(input.fallback_config),
        input.priority
      )
      .run();
    
    return {
      success: true,
      api_name: input.api_name,
      operation_id: input.operation_id || 'all',
      fallback_type: input.fallback_type,
      message: 'Fallback configuration added successfully'
    };
  }
});

// ============================================================================
// Export All Tools
// ============================================================================

export const dynamicAPITools = {
  loadAPIFromURL: loadAPIFromURLTool,
  callDynamicAPI: callDynamicAPITool,
  getAvailableAPIs: getAvailableAPIsTool,
  getAPIEndpoints: getAPIEndpointsTool,
  checkAPIHealth: checkAPIHealthTool,
  getAPIPerformance: getAPIPerformanceTool,
  toggleAPIEndpoint: toggleAPIEndpointTool,
  addAPIFallback: addAPIFallbackTool
};
