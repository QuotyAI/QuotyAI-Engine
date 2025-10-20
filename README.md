# QuotyAI Engine

> **⚠️ Early Development Notice**: This is version 0.1.0 of the QuotyAI Engine. As an early-stage project, expect frequent breaking changes, new features, and API modifications. We're actively developing and refining the platform - your feedback is invaluable!

Welcome to the QuotyAI engine! This is the heart of our reliable AI chatbot quoting system. We're building a community-driven platform that eliminates the chaos of inconsistent LLM pricing and brings deterministic, programmable quotes to businesses worldwide.

## What We Solve

Stop losing customers to your chatbot's random pricing and inaccurate calculations. QuotyAI transforms flaky AI responses into rock-solid, programmable quotes that reflect your actual business rules.

### The Problem with Standard LLMs
- **Non-deterministic pricing** that erodes customer trust
- **Exploitability** where chatbots give unauthorized discounts
- **Complex prompting** that requires constant tuning
- **High costs and slow responses** that kill conversions
- **Black box problems** with no observability or debugging

### Our Solution
QuotyAI uses AI where it excels (understanding complex pricing models) and deterministic code where you need reliability. We generate accurate, programmable pricing logic that executes consistently without hallucinations.

## Community & Contributing

We believe in building together! QuotyAI is an open-source project that welcomes contributors from all backgrounds. Whether you're a developer, business owner, or AI enthusiast, there's a place for you in our community.

### Ways to Get Involved
- **🐛 Report Issues**: Found a bug? Let us know on GitHub
- **💡 Suggest Features**: Have ideas for improving quoting systems? Share them!
- **🔧 Contribute Code**: Help build the future of reliable AI quoting
- **📖 Improve Documentation**: Make our docs clearer and more accessible
- **🧪 Test & Validate**: Help ensure our pricing logic works perfectly

### Getting Started for Contributors
Ready to jump in? Here's how to get the backend running locally:

## Quick Start

### For Contributors
```bash
# Clone the repo
cd quotyai/backend

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add your LLM API keys and database config

# Start development server
npm run start:dev
```

### For Businesses
Visit [quotyai.com](https://quotyai.com) to see how QuotyAI can transform your chatbot's quoting accuracy.

## API Overview

The QuotyAI engine provides RESTful endpoints for:
- **Pricing Agent Management**: Create and manage AI-powered pricing agents
- **Input Processing**: Handle natural language pricing descriptions
- **Code Generation**: Transform rules into deterministic TypeScript functions
- **Testing & Validation**: Ensure pricing logic accuracy
- **Multi-Tenant Support**: Secure data isolation between businesses

### Key Endpoints
- `POST /builder/pricing-agents` - Create pricing agent
- `POST /builder/pricing-agents/:id/messages` - Add pricing rules
- `POST /builder/pricing-agents/:id/build` - Generate pricing function
- `POST /playground/execute` - Test pricing calculations

## AI Agent Pipeline

### Schema Generation Agent
- Analyzes natural language pricing descriptions
- Generates TypeScript interfaces for input parameters
- Ensures type safety and validation

### Formula Generation Agent
- Converts pricing rules to executable TypeScript functions
- Implements complex logic with conditionals, loops, and arithmetic
- Produces deterministic, testable code

### Testing Dataset Generation Agent
- Creates comprehensive test scenarios
- Generates happy path and edge case tests
- Validates function correctness against business rules

### Prerequisites
- Node.js v18+
- MongoDB (local or cloud)
- TypeScript
- Access to LLM API (OpenAI, Anthropic, etc.)

### Installation
```bash
cd backend
npm install
```

### Configuration
```bash
# Copy environment template
cp .env.example .env

# Configure required settings:
# - Database connection (MONGODB_URI)
# - LLM API keys (OPENAI_API_KEY, etc.)
# - Multi-tenancy settings (ENABLE_MULTI_TENANCY)
# - Firebase service account path (FIREBASE_SERVICE_ACCOUNT_PATH)
```

### Running the Application
```bash
# Development mode
npm run start:dev

# Production build
npm run build
npm run start:prod

# Generate OpenAPI documentation
npm run build
node generate-openapi.js
```

### Testing
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Authentication System

The QuotyAI Engine features a flexible, provider-agnostic authentication system designed to support multiple authentication providers out of the box. This architecture allows businesses to integrate with their preferred identity management solutions without vendor lock-in.

### Supported Providers
- **Firebase Authentication**: Primary provider with full integration
- **Supabase**: Planned support for Supabase Auth
- **Auth0**: Planned support for Auth0 authentication
- **Custom Providers**: Extensible architecture for additional providers

### Key Features
- **Provider Abstraction**: Clean interface for adding new auth providers
- **Token Verification**: Secure JWT token validation across all providers
- **User Management**: Unified user operations regardless of provider
- **Multi-Tenant Support**: Authentication integrated with tenant isolation
- **Role-Based Access**: Flexible permission system with admin/super-admin roles
- **Multiple Auth Methods**: Frontend supports Google OAuth, GitHub OAuth, and email/password authentication

### Architecture
The auth system uses a provider pattern with:
- `AuthProvider` interface for consistent provider implementations
- `AuthService` for unified auth operations across providers
- `AuthGuard` for route protection with automatic token verification
- Provider-specific implementations (currently Firebase, extensible for others)

## Key Technologies

- **NestJS**: Progressive Node.js framework for building efficient APIs
- **MongoDB**: NoSQL database with native Node.js driver
- **LangChain**: LLM framework for AI agent orchestration
- **TypeScript**: Type-safe development with full IntelliSense support
- **Firebase Admin SDK**: Authentication and user management
- **Swagger/OpenAPI**: API documentation and testing

## Security & Compliance

- **Multi-Tenant Isolation**: Complete data segregation between tenants
- **Audit Trails**: Comprehensive logging of all operations
- **Input Validation**: Strict validation of all API inputs
- **Rate Limiting**: Protection against abuse
- **CORS Configuration**: Secure cross-origin resource sharing

## License

⚠️ **Important Licensing Notice**

The QuotyAI Engine is licensed under the **Business Source License (BSL) 1.0**, a source-available license that allows for commercial use while protecting the project's sustainability. This license ensures that:

- **Source Access**: Anyone can view, modify, and distribute the source code
- **Commercial Use**: Businesses can use and modify the engine for their own applications
- **Production Use**: Commercial production use requires a commercial license
- **Future Open Source**: The license automatically converts to GPL v2+ after 4 years

### BSL vs Other Licenses
The BSL provides a balanced approach between open source accessibility and commercial viability. It allows developers to use and contribute to the codebase while ensuring that commercial exploitation supports continued development and maintenance.

See the [LICENSE](LICENSE) file for the complete license text and terms.
