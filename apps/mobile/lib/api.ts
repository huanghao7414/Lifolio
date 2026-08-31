import { LifolioAPIClient } from '@lifolio/api-client';
import { supabase } from './supabase';

export const api = new LifolioAPIClient({
  baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8000',
  getToken: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
});
