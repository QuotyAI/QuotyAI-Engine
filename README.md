# QuotyAI Engine

> **⚠️ Early Development Notice**: This is version 0.1.0 of the QuotyAI Engine. As an early-stage project, expect frequent breaking changes, new features, and API modifications. We're actively developing and refining the platform - your feedback is invaluable!

The QuotyAI Engine is a powerful backend API that transforms natural language business rules into deterministic, programmable pricing functions. Built for developers and businesses who need reliable AI-powered quoting systems.

## Problems Solved

### 🚫 **Inconsistent AI Pricing**
Stop losing customers to chatbots that give different quotes for the same service. Our engine generates **deterministic pricing functions** that always return the same result for identical inputs.

### 💸 **Exploitable Pricing Logic**
Manual pricing rules are vulnerable to manipulation. We create **type-safe, validated functions** that enforce your business constraints and prevent unauthorized discounts.

### 🧪 **Inadequate Testing**
Traditional testing misses edge cases. Our platform provides **AI-generated comprehensive test suites** covering both happy paths and error conditions.

### 🔒 **Security & Compliance**
Shared AI infrastructure poses risks. We offer **enterprise-grade isolation** with multi-tenant architecture and secure API key management.

### 📈 **Scalability Challenges**
Manual systems don't scale. Our engine supports **automated deployment** and **integration APIs** for seamless scaling across multiple chatbots and platforms.

## Technical Highlights

### 🧠 **AI Agent Architecture**
- **Specialized AI agents** for schema generation, formula creation, and testing
- **Multi-turn conversation processing** with context-aware order conversion
- **Structured output validation** ensuring AI responses meet technical requirements
- **Vision-capable agents** for processing pricing table images
- **Iterative refinement loops** with feedback-based code improvement

### 🏗️ **System Design**
- **NestJS framework** with modular architecture and dependency injection
- **MongoDB native driver** for optimized database operations
- **TypeScript compilation pipeline** with runtime code generation
- **Sandbox execution environment** using Node.js VM module
- **Immutable checkpoint system** for version control and audit trails

### 🔧 **Development Tooling**
- **Nx monorepo** for efficient multi-package development
- **Swagger/OpenAPI** for interactive API documentation
- **Jest testing framework** with comprehensive test coverage
- **ESLint + Prettier** for code quality and consistency
- **Hot reload development** with efficient iteration cycles

### 📊 **Data Architecture**
- **Multi-tenant data isolation** with tenant-specific collections
- **Audit logging system** with hierarchical operation tracking
- **Versioned checkpoints** with complete state snapshots
- **Optimized query patterns** for performance and scalability
- **Schema validation** with comprehensive input sanitization


## Key Capabilities

- **🤖 AI-Powered Code Generation**: Transform natural language pricing rules into executable TypeScript functions
- **🔄 Dynamic Execution**: Safe sandboxed environment for running generated pricing logic
- **🧪 Comprehensive Testing**: AI-generated test scenarios with automated validation
- **🏢 Multi-Tenant Architecture**: Secure data isolation between businesses
- **🔑 API Key Management**: Secure authentication for external integrations
- **📊 Audit Trails**: Detailed backtraces of all pricing calculations
- **🔗 Integration APIs**: RESTful endpoints for chatbot platforms
- **🎭 Playground Testing**: Interactive environment for testing conversations
- **📸 Image Processing**: Extract pricing tables from uploaded images
- **🏷️ Version Control**: Immutable checkpoints with rollback capabilities

## Future Integrations

### 🤖 **Chatbot Platform APIs**
- **Dialogflow CX**: RESTful integration with Google Dialogflow CX webhooks
- **Microsoft Bot Framework**: Direct API integration with Azure Bot Services
- **Amazon Lex V2**: Native support for AWS Lex conversational interfaces
- **Rasa Action Server**: Integration with Rasa's custom action endpoints
- **Custom Webhook Support**: RESTful webhook support for any chatbot platform

### 🌐 **Omnichannel Platforms**
- **Chatwoot**: Native integration for unified customer communication
- **Intercom**: Direct integration with Intercom's messaging platform
- **Zendesk**: Integration with Zendesk customer service platform
- **Freshchat**: Seamless integration with Freshworks conversational support
- **CRM Webhooks**: Integration with any CRM system via webhooks

### ⚡ **Automation Platforms**
- **Zapier**: Pre-built Zapier integrations for workflow automation
- **n8n**: Native n8n nodes for complex workflow orchestration
- **Make (Integromat)**: Integration with Make's visual workflow builder
- **Microsoft Power Automate**: Integration with enterprise automation workflows
- **Custom API Endpoints**: RESTful API support for any automation platform

### 🔗 **Developer Ecosystem**
- **SDK Libraries**: Client libraries for Python, JavaScript, and other languages
- **API Marketplace**: Publish pricing agents to integration marketplaces
- **Webhook Events**: Real-time event streaming for external system integration
- **OAuth 2.0**: Secure third-party application integrations
- **Docker Integration**: Containerized deployments for cloud platforms

## Getting Started

### Prerequisites
- Node.js v18+
- MongoDB (local or cloud)
- Access to LLM API (OpenAI, Anthropic, Google Vertex AI, Azure OpenAI)

### Installation & Setup
```bash
cd backend
npm install
cp .env.example .env
# Configure: MONGODB_URI, LLM API keys, ENABLE_MULTI_TENANCY, FIREBASE_SERVICE_ACCOUNT_PATH
npm run start:dev
```

### API Documentation
Once running, visit `/api` for interactive Swagger documentation.

## Community & Contributing

We welcome contributors! Help us build the future of reliable AI quoting:

- **🐛 Report Issues**: Found a bug? Let us know on GitHub
- **💡 Suggest Features**: Ideas for improving quoting systems? Share them!
- **🔧 Contribute Code**: Help build reliable AI pricing logic
- **🧪 Test & Validate**: Ensure our pricing functions work perfectly
- **📖 Improve Documentation**: Make our docs clearer and more accessible

## License

⚠️ **Important Licensing Notice**

The QuotyAI Engine is licensed under the **Business Source License (BSL) 1.0**, a source-available license that allows for commercial use while protecting the project's sustainability. This license ensures that:

- **Source Access**: Anyone can view, modify, and distribute the source code
- **Commercial Use**: Businesses can use and modify the engine for their own applications
- **Production Use**: Commercial production use requires a commercial license

### BSL vs Other Licenses
The BSL provides a balanced approach between open source accessibility and commercial viability. It allows developers to use and contribute to the codebase while ensuring that commercial exploitation supports continued development and maintenance.

See the [LICENSE](LICENSE) file for the complete license text and terms.
