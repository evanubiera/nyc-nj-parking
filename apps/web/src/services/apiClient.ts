// The one place the web app creates an API client (WEB-3). The API is same-origin, under /api.
import { createApiClient, type ApiClient } from '@parking/api-client';

export const apiClient: ApiClient = createApiClient();
