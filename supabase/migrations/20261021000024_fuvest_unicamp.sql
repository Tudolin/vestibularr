-- 0024: vestibulares próprios de outras universidades públicas — Fuvest (USP) e Unicamp (Comvest).
-- Só cadastra as bancas e o formato da 1ª fase; as provas entram pelo npm run seed:provas (data/fuvest, data/unicamp).
-- Idempotente.

insert into public.exam_boards (code, name, kind) values
  ('FUVEST', 'Fuvest (USP)', 'vestibular'),
  ('UNICAMP', 'Unicamp (Comvest)', 'vestibular')
on conflict (code) do update set name = excluded.name, kind = excluded.kind;

-- 1ª fase: Fuvest com 90 questões de A a E; Unicamp com 72 questões de A a D. As duas em 5 horas.
insert into public.exam_formats (board_id, code, name, valid_from_year, valid_to_year, structure)
select b.id, f.code, f.name, null, null, f.structure::jsonb
  from public.exam_boards b
  join (values
    ('FUVEST', 'FUVEST_1fase', 'Fuvest — 1ª fase (90 questões)',
     '{"duration_minutes":300,"alternatives":5,"sections":[{"key":"geral","name":"Conhecimentos gerais","questions":90}]}'),
    ('UNICAMP', 'UNICAMP_1fase', 'Unicamp — 1ª fase (72 questões)',
     '{"duration_minutes":300,"alternatives":4,"sections":[{"key":"geral","name":"Conhecimentos gerais","questions":72}]}')
  ) as f (board, code, name, structure) on f.board = b.code
on conflict (code) do update set name = excluded.name, structure = excluded.structure;
