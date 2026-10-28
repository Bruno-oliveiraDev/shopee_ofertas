-- 28/10/2026: mais buscas pro grupo nao ficar sem oferta (anti-repeticao esgotou a fila).
-- Pedido do Bruno: carrinho de bebe, chupetas e roupinhas. Mexe so nas chaves citadas de ajustes('robo').
update public.ajustes
set valor = valor
  || jsonb_build_object('categorias', (valor->'categorias') || $j${
    "roupa": ["body bebê manga curta","body bebê manga longa","kit body bebê","carters bebê","calça bebê","mijão bebê","macacão bebê","conjunto bebê",
              "roupinha bebê","kit roupa bebê","roupa bebê menina","roupa bebê menino","vestido bebê","macaquinho bebê","pijama bebê","jardineira bebê","saída maternidade","conjunto infantil menino","conjunto infantil menina"],
    "alimentacao": ["chupeta","chupeta ortodôntica","kit chupeta","chupeta lillo","chupeta nuk","chupeta mam"],
    "passeio": ["carrinho de bebê","carrinho de passeio bebê","carrinho bebê travel system","carrinho guarda-chuva bebê"]
  }$j$::jsonb)
  || jsonb_build_object('pesoCategoria', (valor->'pesoCategoria') || '{"passeio": 1}'::jsonb)
  || jsonb_build_object('filtrosPorCategoria', (valor->'filtrosPorCategoria') || $j${
    "roupa": {"exigir": [["body","bodie","calca","culote","macacao","conjunto","carter","mijao","pagao","macac","roupa","roupinha","vestido","pijama","jardineira","saida","short","camiseta","blusa","enxoval"],
                         ["bebe","bebê","infantil","rn","recem","recém","menino","menina","baby","meses","carter","maternidade"]],
              "comissaoMinima": 0.03},
    "alimentacao": {"exigir": [["chupeta"]], "comissaoMinima": 0.03, "descontoMinimo": 0},
    "passeio": {"exigir": [["carrinho"],["bebe","bebê","baby","infantil","passeio","travel","guarda chuva","guarda-chuva"]],
                "precoMaximo": 2000, "comissaoMinima": 0.02, "descontoMinimo": 3, "vendasMinimas": 50}
  }$j$::jsonb)
  || jsonb_build_object('filtros', (valor->'filtros') || jsonb_build_object('exigir',
       jsonb_build_array((valor->'filtros'->'exigir'->0) || '["chupeta","carrinho de bebe","roupinha"]'::jsonb)))
where chave = 'robo';

select valor->'categorias' as categorias, valor->'filtros'->'exigir' as exigir from public.ajustes where chave = 'robo';
