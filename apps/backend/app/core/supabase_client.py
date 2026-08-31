from supabase import create_client, Client
from app.core.config import settings

# Service-role client for server-side operations (bypasses RLS when needed)
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
