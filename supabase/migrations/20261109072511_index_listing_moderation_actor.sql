create index if not exists listing_moderation_events_actor_created_idx
  on public.listing_moderation_events (actor_id, created_at desc);
