import { Module } from "@nestjs/common";
import { ConversationParserAgent } from "./agents/conversation-parser.agent";
import { NegotiationOptimizerAgent } from "./agents/negotiation-optimizer.agent";
import { InferenceService } from "./agents/inference/inference.service";
import { WorkerPoolProcessor } from "./agents/inference/worker-pool.processor";
import { ModelManagerService } from "./agents/models/model-manager.service";
import { CompilationService } from "./agents/models/datasets/compilation.service";
import { OnlineLearnerService } from "./agents/models/training/online-learner.service";
import { ValidationService } from "./agents/models/evaluation/validation.service";
import { FeatureAttributionService } from "./agents/models/explainability/feature-attribution.service";
import { StreamIngestPipe } from "./agents/pipelines/stream-ingest.pipe";
import { LogicFilterInterceptor } from "./agents/pipelines/logic-filter.interceptor";
import { WeightRegistryService } from "./agents/registry/weight-registry.service";
import { IntelligenceModule } from "./intelligence/intelligence.module";
import { EngineeringModule } from "./engineering/engineering.module";

@Module({
  imports: [IntelligenceModule, EngineeringModule],
  providers: [
    ConversationParserAgent, NegotiationOptimizerAgent, InferenceService,
    WorkerPoolProcessor, ModelManagerService, CompilationService,
    OnlineLearnerService, ValidationService, FeatureAttributionService,
    StreamIngestPipe, LogicFilterInterceptor, WeightRegistryService
  ],
  exports: [InferenceService, ConversationParserAgent]
})
export class TuskModule {}
