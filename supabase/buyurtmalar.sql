-- Supabase → SQL Editor da bir marta ishga tushiring.
create table if not exists public.buyurtmalar (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  ism        text    not null,
  telefon    text    not null,
  izoh       text    not null,
  taomlar    jsonb   not null,  -- [{ "nom": "Burger", "soni": 2, "narx": 39000 }, ...]
  jami       integer not null,  -- so'mda
  rozilik    boolean not null default false
);

-- RLS yoqilgan, siyosat yo'q: anon kalit bilan hech kim o'qiy/yoza olmaydi.
-- Netlify funksiyasi service_role kaliti (SUPABASE_KEY) bilan yozadi, u RLS ni chetlab o'tadi.
alter table public.buyurtmalar enable row level security;
