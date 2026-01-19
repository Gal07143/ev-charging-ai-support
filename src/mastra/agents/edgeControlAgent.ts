const KNOWLEDGE_BASE = `
# Edge Control - AI Support Agent

You are a helpful EV charging support assistant for Edge Control.

## Key Capabilities:
- Multi-language support (Hebrew, English, Russian, Arabic)
- Knowledge base search with semanticSearch tool
- Charger diagnostics and troubleshooting
- Escalation to human agents when needed
- Real-time charger status monitoring

## Escalation Rules:
- Safety issues: IMMEDIATE escalation
- Repeated failures: escalate after 3 attempts
- Frustrated users: check sentiment and escalate
- Complex technical issues: escalate to specialist

## Best Practices:
1. Always search knowledge base first
2. Show empathy before technical details
3. Ask clarifying questions
4. Provide step-by-step solutions
5. Follow up to ensure resolution
6. Never make up information
7. End with follow-up question

Be helpful, professional, and human! 🚗⚡
`;
// Updated Hebrew knowledge base with RAG integration + Multi-Language Support

export const edgeControlAgent = new Agent({
  name: 'Edge Control Support Agent',
  instructions: KNOWLEDGE_BASE,
  model: {
    provider: 'openai',
    name: 'gpt-4o',
    toolChoice: 'auto',
  },
  tools: {
    // RAG Knowledge Base Search - Use this FIRST for any question
    semanticSearch: semanticSearchTool,
    
    // Charger Database Tools - Technical specs and error codes
    searchChargerModels: searchChargerModelsTool,
    lookupErrorCode: lookupErrorCodeTool,
    getChargerSpecs: getChargerSpecsTool,
    searchTroubleshooting: searchTroubleshootingTool,
    checkVehicleCompatibility: checkVehicleCompatibilityTool,
    getChargerStats: getChargerStatsTool,
    
    // Diagnostic Workflow Tools - Use for structured troubleshooting
    findMatchingWorkflow: findMatchingWorkflowTool,
    startDiagnosticWorkflow: startDiagnosticWorkflowTool,
    continueDiagnosticWorkflow: continueDiagnosticWorkflowTool,
    getWorkflowAnalytics: getWorkflowAnalyticsTool,
    
    // Multi-Language Translation Tools
    detectLanguage: detectLanguageTool,
    translateText: translateTextTool,
    getUserLanguage: getUserLanguageTool,
    
    // Ampeco API Tools
    ampecoStationStatus: ampecoStationStatusTool,
    ampecoResetStation: ampecoResetStationTool,
    ampecoUnlockConnector: ampecoUnlockConnectorTool,
    ampecoActiveSession: ampecoActiveSessionTool,
    ampecoSessionHistory: ampecoSessionHistoryTool,
    ampecoTariff: ampecoTariffTool,
    
    // Media & Tracking Tools
    analyzeStationImage: analyzeStationImageTool,
    trackFailedConversation: trackFailedConversationTool,
    
    // Escalation Tools - Smart human handoff
    checkEscalation: checkEscalationTool,
    createEscalationTicket: createEscalationTicketTool,
    getEscalationAnalytics: getEscalationAnalyticsTool,
    getActiveEscalations: getActiveEscalationsTool,
    resolveEscalation: resolveEscalationTool,
    
    // Quality Scoring Tools - Conversation quality & A/B testing
    scoreConversationQuality: scoreConversationQualityTool,
    getQualityAnalytics: getQualityAnalyticsTool,
    getLowQualityConversations: getLowQualityConversationsTool,
    getToolEffectiveness: getToolEffectivenessTool,
    
    // Predictive Detection Tools - ML-based predictions & proactive alerts
    predictSessionOutcome: predictSessionOutcomeTool,
    detectAnomalies: detectAnomaliesTool,
    sendProactiveNotification: sendProactiveNotificationTool,
    getHighRiskUsers: getHighRiskUsersTool,
    getActiveAnomalies: getActiveAnomaliesTool,
    
    // Rich Media Tools - OCR, voice transcription, image/video analysis
    uploadMedia: uploadMediaTool,
    getOCRResults: getOCRResultsTool,
    getTranscription: getTranscriptionTool,
    getMediaStatus: getMediaStatusTool,
    analyzeStationImageAdvanced: analyzeStationImageAdvancedTool,
    getRecentMedia: getRecentMediaTool,
    
    // Analytics Dashboard Tools - Real-time metrics and reporting
    getDashboardMetrics: getDashboardMetricsTool,
    getRealtimeMetrics: getRealtimeMetricsTool,
    getGeographicHotspots: getGeographicHotspotsTool,
    getToolEffectivenessDashboard: getToolEffectivenessTool,
    getTrendAnalysis: getTrendAnalysisTool,
    exportDashboardData: exportDashboardDataTool,
    getExportStatus: getExportStatusTool,
    getPerformanceSummary: getPerformanceSummaryTool,
    
    // Vehicle-Charger Compatibility Tools - EV model database and compatibility checks
    searchEVModels: searchEVModelsTool,
    checkVehicleChargerCompatibility: checkVehicleChargerCompatibilityTool,
    getOEMChargingQuirks: getOEMChargingQuirksTool,
    getPopularEVModels: getPopularEVModelsTool,
    
    // Dynamic API Tools (Feature #12)
    loadAPIFromURL: loadAPIFromURLTool,
    callDynamicAPI: callDynamicAPITool,
    getAvailableAPIs: getAvailableAPIsTool,
    getAPIEndpoints: getAPIEndpointsTool,
    checkAPIHealth: checkAPIHealthTool,
    getAPIPerformance: getAPIPerformanceTool,
    toggleAPIEndpoint: toggleAPIEndpointTool,
    addAPIFallback: addAPIFallbackTool,
    
    // Sentiment Analysis Tools (Feature #13)
    analyzeMessageSentiment: analyzeMessageSentimentTool,
    getConversationTrajectory: getConversationTrajectoryTool,
    getHighRiskConversations: getHighRiskConversationsTool,
    getResponseTemplate: getResponseTemplateTool,
    getSentimentTrends: getSentimentTrendsTool,
    
    // Caching & Circuit Breaker Tools (Feature #14)
    getCacheStats: getCacheStatsTool,
    invalidateCache: invalidateCacheTool,
    getCircuitBreakerStatus: getCircuitBreakerStatusTool,
    resetCircuitBreaker: resetCircuitBreakerTool,
    cleanupExpiredCache: cleanupExpiredCacheTool,
    getCachePerformanceByType: getCachePerformanceByTypeTool,
    
    // Automated KB Update Tools (Feature #15)
    checkDocSource: checkDocSourceTool,
    getPendingKBReviews: getPendingKBReviewsTool,
    getKBScrapingHealth: getKBScrapingHealthTool,
    getRecentKBChanges: getRecentKBChangesTool,
    
    // Conversation Search Tools (Feature #16)
    searchConversations: searchConversationsTool,
    getSimilarConversations: getSimilarConversationsTool,
    getConversationSummary: getConversationSummaryTool,
    getHighQualityResolutions: getHighQualityResolutionsTool,
    getSearchAnalytics: getSearchAnalyticsTool,
    
    // Proactive Maintenance Tools (Feature #17)
    getChargerHealth: getChargerHealthTool,
    getCriticalAlerts: getCriticalAlertsTool,
    getUpcomingMaintenance: getUpcomingMaintenanceTool,
    getHealthDashboard: getHealthDashboardTool,
    scheduleMaintenance: scheduleMaintenanceTool,
    
    // P3 Strategic Tools (Features #18-25)
    startWorkflow: startWorkflowTool,
    getUserProfile: getUserProfileTool,
    updateUserProfile: updateUserProfileTool,
    getRecommendations: getRecommendationsTool,
    checkFraudRisk: checkFraudRiskTool,
    logVoiceCommand: logVoiceCommandTool,
    getUserPoints: getUserPointsTool,
    awardPoints: awardPointsTool,
    getKPIMetrics: getKPIMetricsTool,
    executeReport: executeReportTool,
    validateAPIKey: validateAPIKeyTool,
    logAPIRequest: logAPIRequestTool,
  },
  memory,
});
