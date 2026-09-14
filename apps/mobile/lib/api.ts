import { LifolioAPIClient } from '@lifolio/api-client';
import { fetch as expoFetch } from 'expo/fetch';
import { supabase } from './supabase';

export const api = new LifolioAPIClient({
  baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8000',
  streamFetch: expoFetch as unknown as typeof fetch,
  getToken: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
});
