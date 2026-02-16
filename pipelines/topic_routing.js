// pipelines/topic_routing.js — Topic routing pipeline
// Unified entry point cho topic extraction + scoring + routing
// Phase 1: re-export wrappers. Phase 3: consolidate logic.

export { extractTopics, extractTopicsFromText } from '../bridge/topic_extractor.js';
export { routeToTopic, autoRouteTopic } from '../bridge/topic_router.js';
export { scoreTopic, scoreTopicRelevance } from '../bridge/topic_scoring.js';
