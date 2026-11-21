-- Live truck features: today's spot, open/closed override, specials, menu, socials, payment types,
-- owner photo management, and a guard so owners can't change admin-only fields.
alter table public.restaurants
  add column if not exists today_spot text,
  add column if not exists today_lat double precision,
  add column if not exists today_lng double precision,
  add column if not exists today_until timestamptz,
  add column if not exists open_override text check (open_override in ('open','closed')),
  add column if not exists open_override_until timestamptz,
  add column if not exists special text,
  add column if not exists special_until timestamptz,
  add column if not exists menu jsonb not null default '[]'::jsonb,
  add column if not exists instagram text,
  add column if not exists facebook text,
  add column if not exists accepts text[];

create or replace function public.protect_admin_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '') = 'authenticated' then
    new.status := old.status; new.is_active := old.is_active; new.is_sponsored := old.is_sponsored;
    new.is_featured := old.is_featured; new.sponsored_until := old.sponsored_until;
    new.sponsored_reminder_for := old.sponsored_reminder_for; new.admin_notes := old.admin_notes;
    new.is_food_truck := old.is_food_truck;
  end if;
  return new;
end $$;
drop trigger if exists protect_admin_fields on public.restaurants;
create trigger protect_admin_fields before update on public.restaurants for each row execute function public.protect_admin_fields();

create policy "owners add own photos" on public.photos for insert to authenticated with check (public.is_owner_of(restaurant_id));
create policy "owners delete own photos" on public.photos for delete to authenticated using (public.is_owner_of(restaurant_id));
create policy "owners update own photos" on public.photos for update to authenticated using (public.is_owner_of(restaurant_id)) with check (public.is_owner_of(restaurant_id));
