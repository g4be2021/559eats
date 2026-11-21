-- Applied to production 2026-11-20 (featured_billing_and_events, business_stats_rpc)
-- Featured truck billing: Stripe ids on restaurants (owners cannot edit them)
alter table public.restaurants
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;
-- protect_admin_fields() also locks stripe_customer_id / stripe_subscription_id for owners.
-- events table (public reads published rows; admin writes through /api/admin)
-- business_stats() RPC (service role only) feeds the admin Business tab.
