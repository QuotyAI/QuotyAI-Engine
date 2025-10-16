# Pricing Agent Builder - Open Source Edition

This is the open-source version of the Pricing Agent Builder, designed for single-tenant usage only. This version does not support multi-tenancy features.

## Features

- Build and manage pricing agents
- AI-powered schema and formula generation
- Testing dataset management
- Single-tenant architecture

## Installation

```bash
npm install
```

## Configuration

Set the following environment variables:

```env
ENABLE_MULTI_TENANCY=false
MONGODB_URI=your_mongodb_connection_string
```

## Running

```bash
# Development
npm run start:dev

# Production
npm run build:oss
npm run start:prod
```

## API Usage

All endpoints work without requiring `tenantId` parameters since this is a single-tenant system.

## License

Business Source License 1.0 - see LICENSE file for details.

## Enterprise Version

For multi-tenant capabilities, contact us for the enterprise version which includes:
- Multi-tenant data isolation
- Advanced user management
- Enterprise support
- Commercial licensing
