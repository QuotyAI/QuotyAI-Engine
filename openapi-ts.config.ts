import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: 'https://raw.githubusercontent.com/chatwoot/chatwoot/refs/heads/develop/swagger/swagger.json',
  output: 'src/chatwoot/client',
  plugins: ['@hey-api/client-fetch'], 
});