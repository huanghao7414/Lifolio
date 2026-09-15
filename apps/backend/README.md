# Lifolio API

Python 3.12+ / FastAPI / Supabase. Run commands from `apps/backend`.

```sh
uv sync
test -f .env || cp .env.example .env
# Fill the Supabase values and encryption secret locally.
uv run uvicorn main:app --reload --port 8000
```

The API can start without `OPENAI_API_KEY`. Users can configure their own provider in
`/api/settings/llm`. Dashboard and insight calculations remain usable when AI is not
configured or a provider fails. Explicit AI actions return a readable configuration error.
The API validates bearer tokens with the configured Supabase Auth `/auth/v1/user`
endpoint, including projects using rotated signing keys.

## Database migration and deployment

Apply SQL files in order through your project's trusted Supabase migration workflow or
SQL editor, using an administrative database connection:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_fixes_and_income.sql`
3. `supabase/migrations/003_conversations_and_llm_config.sql`
4. `supabase/migrations/004_ai_history_hardening.sql`
5. `supabase/migrations/005_identity_profiles.sql`

For an existing deployment, apply only missing migrations. Migration 004 is required
by the new backend, even if 003 has already been applied. It adds a stable message
ordering column, enforces that message and conversation owners match, and restricts
these three new tables to the backend service role. The clients must use the backend
API for AI settings and history; direct Supabase table access is intentionally revoked.
Existing RLS protections remain enabled. A mismatched conversation/message owner
causes 004 to roll back: investigate and correct the inconsistent rows before retrying.
The migration also clears old stored provider errors, which earlier development code
could have saved without redaction. It does not delete conversations or messages.
For old rows sharing an identical timestamp, their exact original order cannot be
recovered; the new sequence makes subsequent reads deterministic.

No migration is applied automatically on application startup. Deploy migrations before
restarting the backend, then deploy the web/mobile clients. Check `/health`, `/ready`
and `/api/docs`. A running health endpoint alone does not prove the migrations were applied.

## Authentication and administration

The public `/api/auth/config` describes enabled methods. Supabase Auth issues sessions;
the clients use email/password or SMS OTP. The API verifies every bearer token against
Supabase Auth and uses the verified user UUID for database ownership. To enable SMS,
configure Phone Auth and an SMS provider in Supabase, then set `AUTH_PHONE_ENABLED=true`.
Enable Google in Supabase and set `AUTH_GOOGLE_ENABLED=true` once its OAuth redirect
URLs are configured. WeChat requires a compatible custom OAuth/OIDC broker registered
in Supabase; `AUTH_WECHAT_PROVIDER=custom:<id>` enables its client entry only after
that setup. The flags alone do not create provider credentials.

The `/api/admin/overview` endpoint is read-only and requires a UUID listed in
`ADMIN_USER_IDS`. Empty is deny-all. It returns aggregate table counts, recent profile
display names, and bounded current-process request/latency metrics; it does not return
AI keys, messages or financial rows. `/ready` checks database connectivity without
revealing table data. Multi-worker deployments need a shared monitoring backend if
cross-worker metrics are required.

Set a dedicated, random `LLM_KEY_ENCRYPTION_KEY` in the backend secret manager and
keep it stable across workers and releases. User API keys are Fernet-encrypted using
this secret. If omitted, `SUPABASE_JWT_SECRET` is used. Changing the selected encryption
secret makes saved keys unreadable; users must re-enter them unless ciphertext is
re-encrypted with the previous secret first. Never ship service-role or encryption
secrets to either client.

Custom provider URLs require HTTPS, public DNS/IP addresses, and cannot contain URL
credentials, query parameters or fragments. Requests disable redirects and environment
proxies, use bounded timeouts, and repeat the public-address check before transmission.
Production must additionally deny private, loopback and link-local outbound traffic at
the network layer: DNS validation by itself cannot close DNS-rebinding races. The
server-managed `OPENAI_BASE_URL` is trusted and can target an administrator's private
proxy. A server fallback key is never used for a user-supplied draft URL. Azure OpenAI
is not supported by this OpenAI-compatible adapter; its setting is explicitly rejected.

## Settings and history semantics

- API responses contain a masked key hint and `has_key`, never plaintext/ciphertext keys.
- Omitting `api_key` preserves it; sending `""` clears it and disables that configuration.
- Re-saving the same provider preserves omitted URL/model fields. Switching provider
  applies its defaults and clears the previous credential; provide a new key to enable it.
- `source` is `user`, `global`, or `unconfigured`. Disabled/cleared user settings use the
  server fallback, if configured. An unreadable enabled key returns a configuration error.
- `POST /api/settings/llm/test` with a body tests the merged draft without saving any
  settings or verification metadata. Omitting the body tests the currently active
  configuration, and records verification only for the saved active user configuration.
  Connection testing makes a small billable provider request when invoked by a user.
- Conversation lists return the latest 50 entries by default (maximum 100), with
  `limit`/`offset`. Conversation detail returns the most recent 200 messages in time order;
  earlier messages remain stored. Model context uses the most recent 40 messages.
- With `conversation_id`, the backend reads saved history and accepts only the final
  user message in the request. A user message is saved before generation. A complete
  assistant response is saved on successful completion. Provider failures and cancelled
  streams preserve the user message but do not save incomplete assistant replies.
- SSE emits `content`, `error`, or `warning` objects and `[DONE]` for normal completion.
  A persistence `warning` means the displayed response is not in saved history. No raw
  database/provider errors are reflected in the stream. Clients should preserve the
  displayed reply when they receive this warning. Cancellation closes the provider stream.
- The current API has no transactional turn queue or retry idempotency key; clients
  should send one request at a time per conversation and avoid automatically retrying a
  request after its user message has been accepted.

## Isolated verification

```sh
.venv/bin/python -m pytest -q
```

The test suite sets fake credentials, prevents network access, and replaces Supabase
with an in-memory query double. It does not load a local `.env`, contact a live database,
apply migrations, or call a paid provider. Live integration verification requires a
configured Supabase project and a separately authorized provider probe.
