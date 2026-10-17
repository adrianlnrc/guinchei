-- Bucket privado das Fotos de estado (ADR-0008, ADR-0011).
-- Objetos em "<corrida_id>/<arquivo>". Cliente e Guincheiro da Corrida leem e enviam;
-- a operação lê tudo; ninguém mais. Sem update/delete: são prova de Disputa.
-- O registro em public.fotos_estado (hora do servidor, GPS, autor) é feito à parte.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos-estado',
  'fotos-estado',
  false,
  52428800, -- 50 MiB: vídeo de até 30 s (ADR-0011)
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
);

-- Corrida dona do objeto: a primeira pasta do caminho, se for um uuid.
create function public.corrida_da_pasta(nome_objeto text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(nome_objeto, '/', 1)
      ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(nome_objeto, '/', 1)::uuid
  end;
$$;

create policy "fotos-estado: Cliente e Guincheiro da Corrida leem; a operação lê tudo"
on storage.objects for select to authenticated
using (
  bucket_id = 'fotos-estado'
  and (
    public.participo_da_corrida(public.corrida_da_pasta(name))
    or (select public.eh_operacao())
  )
);

create policy "fotos-estado: Cliente e Guincheiro da Corrida enviam"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'fotos-estado'
  and public.participo_da_corrida(public.corrida_da_pasta(name))
);
