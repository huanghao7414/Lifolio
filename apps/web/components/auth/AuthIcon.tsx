import type { SVGProps } from 'react';

export type AuthIconName = 'email' | 'phone' | 'google' | 'wechat' | 'arrow' | 'eye' | 'eye-off' | 'brand';

export default function AuthIcon({ name, ...props }: Omit<SVGProps<SVGSVGElement>, 'ref'> & { name: AuthIconName }) {
  if (name === 'google') return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
    <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.3 2.98-7.36Z" />
    <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.06a10 10 0 0 0 0 9.02l3.34-2.59Z" />
    <path fill="#EA4335" d="M12 5.96c1.47 0 2.8.5 3.84 1.5l2.88-2.88A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.49l3.34 2.59C7.19 7.72 9.4 5.96 12 5.96Z" />
  </svg>;
  if (name === 'wechat') return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
    <path fill="#07C160" d="M9.15 3C4.64 3 1 5.92 1 9.53c0 2.04 1.19 3.86 3.06 5.06l-.79 2.36 2.85-1.43c.96.35 1.98.53 3.03.53h.3a5.75 5.75 0 0 1-.47-2.24c0-3.62 3.33-6.54 7.43-6.54h.53C15.77 4.78 12.73 3 9.15 3Z" />
    <path fill="#07C160" d="M23 13.81c0-3.03-2.96-5.49-6.61-5.49s-6.61 2.46-6.61 5.49 2.96 5.49 6.61 5.49c.87 0 1.7-.14 2.47-.4l2.44 1.22-.66-2.04C22.1 17.07 23 15.53 23 13.81Z" />
    <circle cx="6.3" cy="7.5" r=".95" fill="white" /><circle cx="11.7" cy="7.5" r=".95" fill="white" />
    <circle cx="14.15" cy="12.25" r=".8" fill="white" /><circle cx="18.65" cy="12.25" r=".8" fill="white" />
  </svg>;
  const shapes = {
    email: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></>,
    phone: <><rect x="6.5" y="2.5" width="11" height="19" rx="3" /><path d="M10 5.5h4M11 18.5h2" /></>,
    arrow: <><path d="M5 12h14m-5-5 5 5-5 5" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    'eye-off': <><path d="m3 3 18 18M10.6 5.1 12 5c6.5 0 10 7 10 7a19.4 19.4 0 0 1-3.1 3.9M6.3 6.3A19.3 19.3 0 0 0 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1M10 10a2.8 2.8 0 0 0 4 4" /></>,
    brand: <><path d="M6 5v12.5A1.5 1.5 0 0 0 7.5 19H19M11 5v8.5a.5.5 0 0 0 .5.5H19M16 5v4h3" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{shapes[name]}</svg>;
}
