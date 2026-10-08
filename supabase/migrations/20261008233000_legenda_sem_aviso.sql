-- Bruno pediu legenda mais natural (08/10): sai a linha final "Link(s) de afiliado: ..." das legendas ja geradas.
update public.carrosseis set legenda = regexp_replace(legenda, '\s*Links? de afiliado:[^\n]*$', '') where legenda ~ 'de afiliado:';
update public.videos set legenda = regexp_replace(legenda, '\s*Links? de afiliado:[^\n]*$', '') where legenda ~ 'de afiliado:';
