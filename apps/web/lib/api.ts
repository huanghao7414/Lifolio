'use client';

import { LifolioAPIClient } from '@lifolio/api-client';
import { createClient } from '@/lib/supabase/client';

let _client: LifolioAPIClient | null = null;

export function getAPIClient(): LifolioAPIClient {
  if (!_client) {
    _client = new LifolioAPIClient({
      baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000',
      getToken: async () => {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? null;
      },
    });
  }
  return _client;
}
