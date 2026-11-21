-- Foster's Media: private visit evidence upload security
-- REVIEW AND RUN IN SUPABASE SQL EDITOR BEFORE ENABLEMENT.
-- Assumes existing public.my_influencer_id(), visits, assignments, visit_screenshots
-- and private storage bucket 'visit-evidence'.

begin;

-- Only an assigned influencer can upload a file for their own visit.
-- File naming: <visit_uuid>/<random_uuid>.<jpg|jpeg|png|webp>
drop policy if exists "fosters_influencer_upload_evidence" on storage.objects;
create policy "fosters_influencer_upload_evidence"
on storage.objects for insert to authenticated
with check (
 bucket_id = 'visit-evidence'
 and (storage.foldername(name))[1] is not null
 and exists (
   select 1 from public.visits v
   join public.assignments a on a.id = v.assignment_id
   where v.id::text = (storage.foldername(name))[1]
     and a.influencer_id = (select public.my_influencer_id())
 )
);

-- Private reads: only the owner of the assigned visit or an admin.
drop policy if exists "fosters_read_evidence" on storage.objects;
create policy "fosters_read_evidence"
on storage.objects for select to authenticated
using (
 bucket_id = 'visit-evidence'
 and (
   (select public.is_fosters_admin())
   or exists (
     select 1 from public.visits v
     join public.assignments a on a.id = v.assignment_id
     where v.id::text = (storage.foldername(name))[1]
       and a.influencer_id = (select public.my_influencer_id())
   )
 )
);

-- Prevent influencers inserting metadata for another person's visit.
drop policy if exists "fosters_influencer_insert_screenshot" on public.visit_screenshots;
create policy "fosters_influencer_insert_screenshot"
on public.visit_screenshots for insert to authenticated
with check (
 exists (
   select 1 from public.visits v
   join public.assignments a on a.id = v.assignment_id
   where v.id = visit_id
     and a.influencer_id = (select public.my_influencer_id())
 )
 and storage_path like (visit_id::text || '/%')
 and exists (
   select 1 from storage.objects o
   where o.bucket_id = 'visit-evidence'
     and o.name = storage_path
 )
);

-- A successful evidence record automatically completes its visit.
create or replace function public.fosters_complete_visit_on_evidence()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.visits
     set completed_at = coalesce(completed_at, now())
   where id = new.visit_id;
  return new;
end;
$$;

drop trigger if exists fosters_evidence_completes_visit on public.visit_screenshots;
create trigger fosters_evidence_completes_visit
after insert on public.visit_screenshots
for each row execute function public.fosters_complete_visit_on_evidence();

-- Restrict direct execution of the trigger function.
revoke all on function public.fosters_complete_visit_on_evidence() from public, anon, authenticated;

commit;
