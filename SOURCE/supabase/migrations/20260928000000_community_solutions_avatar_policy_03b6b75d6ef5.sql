-- ----------------------------------------------------------------------------
-- 24. COMMUNITY SOLUTIONS — Phase 5: avatar của tác giả cộng đồng ký được cho
--     người dùng ĐÃ ĐĂNG NHẬP khác (backend Design Doc v1.9 § Data Contracts
--     "user_profiles.community_comments_last_read_at and
--     avatars_select_community_visible", § Minimal Surface Alternatives
--     Element 3 — Phương án A, engineer chốt 2026-09-17; work plan task 40 —
--     docs/plans/tasks/20260917-feature-community-solutions-backend-task-40.md).
--
--     CỘNG THÊM vào bốn policy avatars_*_own của ADR-0016 ở trên — không sửa
--     policy nào trong số đó (avatars_select_own giữ nguyên từng byte). Policy
--     Storage được OR với nhau, nên policy mới chỉ NỚI thêm người ký được,
--     không bao giờ thu hẹp đường chính chủ đọc ảnh của mình.
--
--     Vì sao KHÔNG phải kịch bản Kill Criteria của ADR-0016 (vốn đòi một ADR
--     mới): bucket vẫn private, policy chỉ `to authenticated` (anon không bao
--     giờ ký được), và vẫn là signed URL ngắn hạn — không có đường đọc
--     "public author profile" hay đọc không đăng nhập nào.
--
--     Cột cộng thêm user_profiles.community_comments_last_read_at đi cùng khối
--     DD này đã thuộc task 25 (§22) — KHÔNG lặp lại ở đây.
-- ----------------------------------------------------------------------------
create or replace function public.community_avatar_owner_visible(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.community_solutions cs
    join public.exams e on e.id = cs.exam_id
    where cs.author_id = p_owner_id and cs.status = 'published' and cs.show_profile
      and e.status = 'published' and not public.is_author_banned(e.author_id)
  ) or exists (
    select 1 from public.community_solution_comments c
    join public.community_solutions cs on cs.id = c.solution_id
    join public.exams e on e.id = cs.exam_id
    where c.author_id = p_owner_id and c.status = 'visible' and not c.is_anonymous
      -- S7 / AC-071: not under a draft or hidden solution. AC-047: not under a
      -- question removed from the exam. AC-048: only under a note of at least
      -- 15 words. S4: not the writer's own comment on a solution whose profile
      -- is hidden.
      and cs.status = 'published' and c.question_id = any(e.question_ids)
      and exists (
        select 1 from public.community_solution_notes n
        where n.solution_id = c.solution_id and n.question_id = c.question_id
          and public.count_words(n.body) >= 15
      )
      and (cs.author_id <> c.author_id or cs.show_profile)
      and e.status = 'published' and not public.is_author_banned(e.author_id)
  );
$$;
revoke all on function public.community_avatar_owner_visible(uuid) from public, anon;
grant execute on function public.community_avatar_owner_visible(uuid) to authenticated;

-- Additive to ADR-0016's avatars_select_own — does not modify it. Scoped
-- narrowly: visible only when the owning account currently has >=1
-- non-anonymous published solution, or non-anonymous visible comment under a
-- published solution, a current question and a note of at least 15 words (not
-- the writer's own comment on a solution whose profile is hidden), on a
-- published exam whose author is not banned. Any
-- reader who reaches this policy has ALREADY passed this feature's own R1
-- gate to learn the object path in the first place (via a masking RPC) —
-- this policy only has to answer "may Storage sign this path," not
-- re-derive R1 itself.
drop policy if exists "avatars_select_community_visible" on storage.objects;
create policy "avatars_select_community_visible" on storage.objects
  for select to authenticated using (
    bucket_id = 'avatars'
    and public.community_avatar_owner_visible(((storage.foldername(name))[1])::uuid)
  );

insert into public.schema_version (id, fingerprint)
values (1, '03b6b75d6ef5')
on conflict (id) do update
  set fingerprint = excluded.fingerprint,
      applied_at  = now();
