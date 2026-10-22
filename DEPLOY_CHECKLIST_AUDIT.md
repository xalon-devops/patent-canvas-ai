# Deploy checklist — full-app audit (branch `claude/full-app-audit`)

Do these in order. Steps 1–3 must happen before or together with the deploy, otherwise payments,
crons or auth emails will misbehave.

1. **Stripe webhook secret** — set `STRIPE_WEBHOOK_SECRET` in edge-function secrets. The webhook now
   rejects unsigned events. In the Stripe endpoint enable: `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
   `checkout.session.expired`, `customer.subscription.*`, `invoice.payment_succeeded`,
   `invoice.payment_failed`, `invoice.payment_action_required`, `charge.refunded`.
2. **Apply migration** `supabase/migrations/20261022120000_security_hardening_integrity_crons.sql`
   (RLS hardening, admin policies, constraints/FKs, indexes, signup credit rows, pg_cron jobs).
3. **Vault secret for crons** (SQL editor, once — never commit the key):
   `select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');`
   Jobs: `prior-art-monitoring` (*/15), `trademark-monitoring` (*/10), `winback-emails` (15:17 UTC daily),
   `expire-manual-grants` (hourly). Check with `select * from cron.job_run_details order by start_time desc limit 20;`
4. **Auth URL config** (Supabase dashboard → Auth → URL configuration): Site URL
   `https://patentbot-ai.com`; redirect allow-list `https://patentbot-ai.com/**`,
   `https://www.patentbot-ai.com/**`.
5. **Optional secrets**: `OAUTH_STATE_SECRET` (falls back to the service key), `APP_ALLOWED_ORIGINS`.
6. **Deploy all edge functions** (most changed; shared helpers in `supabase/functions/_shared/`).
7. **Smoke test** as a free user, a subscriber, and the admin: sign up → 3 free searches → 402 →
   subscribe → unlimited; new application with a file upload → draft → export blocked until paid →
   pay $1,000 → export/download; trademark search → watch → application with specimen; admin grants.

## Open product decisions
- Check & See price: code charges **$99.99/mo** (`pricingConstants.ts`, `create-checkout`). Confirm.
- `subscriptions` is one row per user: buying Trademark Suite replaces Check & See (and vice versa).
- Free searches (3) are shared between prior-art and trademark search.
- The $500 trademark filing fee has no checkout yet.
- Drafting is free; only export/filing requires the $1,000 application payment (or admin / free_grant).
