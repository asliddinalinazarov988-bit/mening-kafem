-- Supabase → SQL Editor da bir marta ishga tushiring.
create table if not exists public.buyurtmalar (
  id         bigint generated always as identity primary key,
  yaratilgan timestamptz not null default now(),
  ism        text    not null,
  telefon    text    not null,
  izoh       text    not null,
  taomlar    jsonb   not null,  -- [{ "nom": "Burger", "soni": 2, "narx": 39000 }, ...]
  jami       integer not null,  -- so'mda
  rozilik    boolean not null default false,
  holat      text    not null default 'yangi'  -- yangi / tayyorlanmoqda / yetkazildi ...
);

-- RLS yoqilgan, siyosat yo'q: anon kalit bilan hech kim o'qiy/yoza olmaydi.
-- Netlify funksiyasi service_role kaliti (SUPABASE_SECRET_KEY) bilan yozadi, u RLS ni chetlab o'tadi.
alter table public.buyurtmalar enable row level security;

-- Jadval avval created_at ustuni bilan yaratilgan bo'lsa, uni yaratilgan deb qayta nomlaydi.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'buyurtmalar' and column_name = 'created_at') then
    alter table public.buyurtmalar rename column created_at to yaratilgan;
  end if;
end $$;
