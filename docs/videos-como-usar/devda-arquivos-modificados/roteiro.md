# Arquivos modificados pelo agente (série "Veja em ação" do DevDA, vídeo 3)

- **Formato:** 9:16 (1080x1920), **60 s**, sem áudio, paleta Data Agile. Material de treinamento.
- **Para que serve:** o ícone com contagem no topo lista os arquivos que o agente criou ou editou na sessão, com quantas vezes, a hora e a letra do git. Em separado vêm as outras alterações do git na pasta. Cada arquivo abre no visualizador na aba "Alterações nesta sessão" (as edições em ordem) e na aba "Arquivo".
- **Material:** prints da **sessão de demonstração** (build local do app, worktree detached na main cd4ef69, sem alteração) e transporte demo copiado para pasta temporária com dados fictícios em pt-BR (`_captura/prep.py` › `prep-arquivos.py` › `prep-modificados.py`): `pc-dev`, `/home/dev/projetos/infra`, 3 arquivos na sessão e 1 no git. Desktop 1440x900 @2x, `pt-BR`, fuso America/Sao_Paulo. Captura: `_captura/shoot-modificados.ts`.
- **Rótulos exatos** (`src/lib/i18n.pt.ts`, `App.tsx`, `ChangedFilesDialog.tsx`, `FileChanges.tsx`, `FileViewer.tsx`): "Arquivos modificados nesta sessão ({n})" (aria-label/title do ícone), "Arquivos modificados", "Nesta sessão", "editado ×{n}", "criado", "Git: modificado", "Git: ainda não rastreado" (title da letra), "Outras alterações no git", "Pode incluir mudanças que não são deste agente.", "Alterações nesta sessão", "Arquivo", "Edição {n} de {total}".

## Gramática de movimento

Igual aos vídeos 1 e 2 (destaque BRAND, títulos expo_out, saídas expo_in, câmera expo_io, contorno que se desenha e rótulo back_out, troca de print em 0,25 s, pulso no clique). Barra de 8 passos.

## Tabela

| tempo | passo | câmera | objetos e motion | legenda (título / apoio · rótulo) |
|---|---|---|---|---|
| 0–4,4 | Capa | — | DevDA, título e apoio sobem | **Veja o que o agente / mudou nos arquivos** / a lista, cada edição e o arquivo como está agora |
| 4,4–11,2 | 1 | tela, zoom no topo (5,6), lista (10,7) | cursor no ícone (7,8); contorno; clique (10,2); lista abre (10,6) | Veja o que mudou / o número no ícone do topo conta os arquivos que o agente alterou · "Arquivos modificados nesta sessão (3)" |
| 11,2–17,0 | 2 | lista | contorno no título da seção; depois nas 3 linhas | Abra a lista / os arquivos que o agente alterou nesta sessão · "Nesta sessão"; "scripts/backup.sh / docs/backup-noturno.md / README.md" |
| 17,0–23,6 | 3 | lista | contorno em "editado ×2 02:42"; depois em "criado" | Leia cada linha / criado ou editado, quantas vezes e a que horas · "editado ×2 / 02:42"; "criado" |
| 23,6–29,6 | 4 | lista | contorno nas letras M e ? | Veja a letra do git / mostra como o git vê o arquivo · "M · Git: modificado / ? · Git: ainda não rastreado" |
| 29,6–35,0 | 5 | lista | contorno na seção de baixo | Outras mudanças / o git também lista o que pode não ser deste agente · "Outras alterações no git" |
| 35,0–41,0 | 6 | visualizador (37,1) | cursor em backup.sh (36,0); clique (36,6); abre nas alterações (37,0); contorno na aba | Abra um arquivo / as edições do agente aparecem em ordem · "Alterações nesta sessão" |
| 41,0–47,4 | 7 | visualizador | contorno na edição 1, depois na 2 | Leia cada edição / em vermelho o que saiu, em verde o que entrou · "Edição 1 de 2"; "Edição 2 de 2" |
| 47,4–54,4 | 8 | visualizador | clique em Arquivo (48,8); arquivo inteiro (49,2); contorno na aba | Veja o arquivo inteiro / a aba Arquivo mostra como ele está agora · "Arquivo" |
| 54,4–60 | Fechamento | — | círculo, visto, frase | **Tudo o que mudou, / em um só lugar** / a lista, as edições e o arquivo inteiro |
