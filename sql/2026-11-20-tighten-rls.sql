-- 559eats: lock down the public (anon) key.
-- Run AFTER the secure-admin site update is live: admin pages now write through /api/admin
-- with the service key, and server routes use the service key too.
-- Owners (signed in via magic link = "authenticated" role) can only touch their own listing.

begin;

-- helper: is the signed-in user an owner of this restaurant?
create or replace function public.is_owner_of(rid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.owners o
    where o.restaurant_id = rid
      and lower(o.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_owner_of(uuid) from public;
grant execute on function public.is_owner_of(uuid) to authenticated;

-- restaurants: no anonymous inserts or edits
drop policy if exists "Allow anon update notes" on public.restaurants;
drop policy if exists "Allow anon insert" on public.restaurants;
create policy "owners read own restaurant" on public.restaurants
  for select to authenticated using (public.is_owner_of(id));
create policy "owners update own restaurant" on public.restaurants
  for update to authenticated using (public.is_owner_of(id)) with check (public.is_owner_of(id));

-- owners: no public read of owner names, emails and phones
drop policy if exists "Service can insert owners" on public.owners;
drop policy if exists "Service can read owners" on public.owners;
drop policy if exists "Service can update owners" on public.owners;
create policy "owner reads own record" on public.owners
  for select to authenticated using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- hours: public can read, owners manage their own
create policy "owners add own hours" on public.hours
  for insert to authenticated with check (public.is_owner_of(restaurant_id));
create policy "owners update own hours" on public.hours
  for update to authenticated using (public.is_owner_of(restaurant_id)) with check (public.is_owner_of(restaurant_id));
create policy "owners delete own hours" on public.hours
  for delete to authenticated using (public.is_owner_of(restaurant_id));

-- photos: public can read, nobody can add or delete with the public key
drop policy if exists "Allow anon insert photos" on public.photos;
drop policy if exists "Allow anon delete photos" on public.photos;
drop policy if exists "Allow anon read photos" on public.photos;

-- bookings: customers can still book; only the owner sees and updates them
drop policy if exists "Public can read own bookings" on public.bookings;
drop policy if exists "Service can update bookings" on public.bookings;
create policy "owners read own bookings" on public.bookings
  for select to authenticated using (public.is_owner_of(restaurant_id));
create policy "owners update own bookings" on public.bookings
  for update to authenticated using (public.is_owner_of(restaurant_id)) with check (public.is_owner_of(restaurant_id));

-- catering: owners see their own requests in the dashboard
create policy "owners read own catering" on public.catering_bookings
  for select to authenticated using (public.is_owner_of(restaurant_id));

commit;
