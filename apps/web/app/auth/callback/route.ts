import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const destination = type === 'recovery' || url.searchParams.get('next') === '/reset-password' ? '/reset-password' : '/dashboard';
  try {
    const supabase = await createClient();
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(destination, url.origin));
    } else if (tokenHash && (type === 'email' || type === 'recovery' || type === 'signup')) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error) return NextResponse.redirect(new URL(destination, url.origin));
    }
  } catch { /* Never put authorization codes or provider responses in the URL. */ }
  return NextResponse.redirect(new URL('/login?auth_error=1', url.origin));
}
