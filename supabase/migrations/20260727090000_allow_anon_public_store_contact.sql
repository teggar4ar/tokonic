-- ==========================================================================
-- TASK-019E: Anon-safe public store WhatsApp contact read
-- The product detail page offers a buyer-initiated WhatsApp entry that links
-- the configured seller number, so the number is public by design (it appears
-- verbatim in the rendered wa.me link). Extends the existing anon column
-- grant on sellers with whatsapp_phone only. The anon SELECT policy from
-- 20260726120000 already covers this read. Origin address/ID, timezone, and
-- Auth identity columns remain ungranted to anon.
-- ==========================================================================

grant select (whatsapp_phone)
  on table public.sellers
  to anon;
