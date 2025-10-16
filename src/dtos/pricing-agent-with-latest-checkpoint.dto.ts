import { PricingAgent, PricingAgentCheckpoint } from '../models/mongodb.model';


export class PricingAgentWithLatestCheckpoint extends PricingAgent {
  latestCheckpoint?: PricingAgentCheckpoint | null;
}
