# Pricing Agent Builder - Enterprise Edition

This is the enterprise version of the Pricing Agent Builder with full multi-tenancy support.

## Features

- Build and manage pricing agents per tenant
- AI-powered schema and formula generation
- Testing dataset management with tenant isolation
- Multi-tenant data architecture
- Advanced user management
- Enterprise-grade security

## Installation

```bash
npm install
```

## Configuration

Set the following environment variables:

```env
ENABLE_MULTI_TENANCY=true
MONGODB_URI=your_mongodb_connection_string
```

## Running

```bash
# Development
npm run start:enterprise

# Production
npm run build:enterprise
npm run start:prod
```

## API Usage

All endpoints require `tenantId` query parameters for proper data isolation:

```bash
# Example: Create pricing agent for a specific tenant
POST /builder/pricing-agents?tenantId=tenant-123
{
  "name": "My Pricing Agent"
}
```

## Multi-Tenancy Architecture

- Complete data isolation between tenants
- Tenant-specific pricing agents and datasets
- Secure API access with tenant context
- Scalable architecture supporting thousands of tenants

## License

Business Source License 1.0 - see LICENSE file for details.

## Open Source Version

A single-tenant open-source version is available at [repository-url] with Business Source License 1.0.
