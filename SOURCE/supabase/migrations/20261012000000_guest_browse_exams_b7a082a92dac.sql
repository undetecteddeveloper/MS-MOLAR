-- Khách chưa đăng nhập đọc được Kho đề (2026-10-12). Chỉ thêm policy + quyền,
-- không đổi bảng/cột — xem schema.sql §29 cho lý do đầy đủ.
grant select on public.exams to anon;
grant select on public.exams_with_difficulty to anon;

drop policy if exists "exams_select_published_anon" on public.exams;
create policy "exams_select_published_anon" on public.exams
  for select to anon using (
    status = 'published' and not public.is_author_banned(author_id)
  );

grant execute on function public.exam_hot_counts(timestamptz, timestamptz, int) to anon;

insert into public.schema_version (id, fingerprint)
values (1, 'b7a082a92dac')
on conflict (id) do update
  set fingerprint = excluded.fingerprint,
      applied_at  = now();
