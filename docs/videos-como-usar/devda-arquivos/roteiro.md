# Arquivos do projeto: árvore, filtro e .md/.html (série "Veja em ação" do DevDA, vídeo 2)

- **Formato:** 9:16 (1080x1920), **55 s**, sem áudio, paleta Data Agile. Material de treinamento.
- **Para que serve:** o botão "Arquivos" no topo abre a árvore da pasta do painel. As pastas abrem ali mesmo, o filtro acha arquivos pelo nome até em pastas fechadas (busca nos arquivos do git) e os .md e .html abrem formatados, com a opção de ver o código.
- **Material:** prints da **sessão de demonstração** (build local do app, worktree detached na main cd4ef69, sem alteração) e transporte demo copiado para pasta temporária com textos fictícios em pt-BR (`_captura/prep.py` + `_captura/prep-arquivos.py`): computador `pc-dev`, pasta `/home/dev/projetos/infra` com docs/, relatorios/, scripts/, terraform/. Desktop 1440x900 @2x, `locale pt-BR`, idioma `pt`. Captura: `_captura/shoot-arquivos.ts`.
- **Rótulos exatos** (`src/lib/i18n.pt.ts`, `src/App.tsx`, `src/components/FileTree.tsx`, `FileViewer.tsx`): "Arquivos" (botão; title "Navegar pelos arquivos"), "Filtrar por nome…", "Busca pelo nome em arquivos do git", "Visualizar", "Código", "Scripts desativados nesta visualização".

## Gramática de movimento

Igual ao vídeo 1: destaque `BRAND`, títulos `expo_out` 0,5 s (apoio 0,13 s depois), círculo do número `back_out`, saídas `expo_in` 0,3 s, câmera `expo_io` 0,8 a 1,2 s, contorno que se desenha em 0,6 s e rótulo com `back_out` 0,35 s depois, troca de print em 0,25 s (`sine_io`), clique com pulso `expo_out` 0,5 s e resultado 0,4 s depois. Barra de 7 passos. Nomes de arquivo no rótulo em mono; texto da tela em semi.

## Tabela

| tempo | passo | câmera | objetos e motion | legenda (título / apoio · rótulo) |
|---|---|---|---|---|
| 0–4,4 s | Capa | — | "DevDA" e o título sobem; o apoio depois | **Navegue pelos / arquivos do projeto** / abra pastas, filtre pelo nome e leia .md e .html |
| 4,4–11,6 s | 1 | tela inteira, zoom no topo (5,6 s), depois na janela Arquivos (10,7 s) | cursor vai ao botão (hover 7,8 s); contorno (8,0 s); clique (10,2 s); janela abre (10,6 s) | Abra os arquivos / o botão fica no topo do painel · "Arquivos" |
| 11,6–17,6 s | 2 | janela Arquivos | cursor na pasta docs (hover 12,8 s); contorno; clique (15,0 s); a pasta abre (15,4 s); contorno nos arquivos de dentro | Abra uma pasta ali mesmo / ela se abre na árvore, sem trocar de tela · "docs"; "arquitetura.md / backup-noturno.md" |
| 17,6–22,4 s | 3 | janela Arquivos | contorno no campo; clique (19,6 s); "bac" (20,4 s) e "backup" (21,0 s) | Filtre pelo nome / digite parte do nome do arquivo · "Filtrar por nome…" |
| 22,4–28,4 s | 4 | janela Arquivos | contorno na nota do filtro; depois em relatorios/ e scripts/, que nunca foram abertas | Ache em qualquer pasta / a busca olha até as pastas que você não abriu · "Busca pelo nome em arquivos do git"; "relatorio-backup.html / backup.sh" |
| 28,4–35,4 s | 5 | zoom no visualizador (30,1 s) | clique em backup-noturno.md (29,6 s); abre formatado (30,0 s); contorno em Visualizar | Leia o .md já formatado / títulos, listas e código prontos para ler · "Visualizar" |
| 35,4–41,0 s | 6 | visualizador | clique em Código (36,8 s); texto puro (37,2 s); contorno | Veja o texto original / em Código, o arquivo aparece como foi escrito · "Código" |
| 41,0–49,6 s | 7 | volta à janela Arquivos (41,0 s), relatório (43,3 s), pan até o aviso (45,6 s) | lista filtrada; clique em relatorio-backup.html (42,8 s); página desenhada (43,2 s); contorno no aviso (46,6 s) | Abra o .html como página / o relatório aparece desenhado, sem rodar scripts · "Scripts desativados nesta visualização" |
| 49,6–55,0 s | Fechamento | — | círculo verde, visto se desenha, frase sobe; parado no fim | **Seus arquivos, / a um clique** / árvore, filtro e .md e .html formatados |
