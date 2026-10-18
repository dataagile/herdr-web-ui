# Copiar o caminho da pasta (série "Veja em ação" do DevDA, vídeo 1)

- **Formato:** 9:16 (1080x1920), **42 s**, sem áudio, paleta Data Agile (padrão do motor). Material de treinamento.
- **Para que serve:** o DevDA mostra no topo em que computador e projeto o painel está, e um clique copia o caminho completo da pasta para colar no terminal, num chamado ou numa mensagem. No celular, o ícone fica no topo e o caminho inteiro é a primeira linha do menu.
- **Material:** prints da **sessão de demonstração**: build local do app (repo somente leitura, origin/main cd4ef69) e transporte demo copiado para uma pasta temporária, com textos fictícios em pt-BR (computador `pc-dev`, pasta `/home/dev/projetos/infra`, painel "Por que o backup falhou?"). Desktop 1440x900 @2x, celular 390x844 @3x, `locale pt-BR`, idioma `pt`.
- **Rótulos exatos** (`src/lib/i18n.pt.ts`, `src/App.tsx`): "Copiar caminho: {path}", "Caminho copiado", "Abrir lista de projetos". O visto dura 1,5 s (`App.tsx:248`).
- O tooltip do navegador (`title`) não aparece em print headless. O texto dele vai no rótulo abaixo do cartão.

## Gramática de movimento

- **Cor de destaque:** `BRAND #01D48D` (contorno, barra, número do passo). `OK #5FD38D` só no resultado "Caminho copiado". Nada de vermelho.
- **Constantes:** barra de 5 passos (y 250), número do passo num círculo, título (ação) e linha de apoio (para quê) em y 370 a 530. O cartão do print fica em x 65 a 940, y 640 a 1400. O rótulo (texto exato da tela) fica abaixo do cartão, entre y 1430 e 1594, sem cobrir o alvo. Área segura 9:16: topo 220, base 320, direita 140.
- **Entrada:** título e apoio sobem com `expo_out` (0,5 s, apoio 0,13 s depois). O círculo do número entra com `back_out`. O cartão sobe 60 px com `expo_out` (0,6 s).
- **Saída:** título, rótulo e cartão saem com `expo_in` (0,3 s).
- **Câmera:** zoom e pan com `expo_io` (1,0 a 1,2 s).
- **Destaque:** contorno que se desenha (`expo_out`, 0,6 s). O rótulo salta com `back_out` 0,35 s depois. Um destaque e um rótulo por vez.
- **Troca de estado (hover, visto):** o print anterior some por cima do novo em 0,25 s (`sine_io`).
- **Clique/toque:** pulso circular (`expo_out`, 0,5 s). O resultado vem 0,4 s depois. A gaveta abre por máscara circular a partir do menu (`expo_io`, 1,0 s).
- **Computador › celular:** o cartão sai para baixo (`expo_in`, 0,3 s) e volta com o celular (`expo_out`, 0,5 s).
- **Leitura:** cada legenda fica na tela pelo menos 0,3 s por palavra depois de inteira; todas ficam acima do mínimo, com folga.

## Tabela

| tempo | passo | câmera | objetos e motion | legenda (título / apoio · rótulo) |
|---|---|---|---|---|
| 0–4,4 s | Capa | — | "DevDA" e o título sobem linha a linha; o apoio sobe depois; tudo sai com `expo_in` | **Copie o caminho / da pasta do painel** / no computador e no celular |
| 4,4–11,0 s | 1. Onde o painel está | área principal do desktop, depois zoom no topo (5,6 s) | o cartão sobe; o cursor entra; contorno em "pc-dev › infra" (7,2 s) | Veja onde o painel está / em qual computador e projeto você está · "pc-dev › infra" |
| 11,0–16,4 s | 2. Copiar | mesma câmera | o cursor vai ao ícone no fim do breadcrumb; print com hover (12,3 s); contorno (12,6 s); clique (15,8 s) | Clique no ícone de copiar / para colar no terminal, num chamado ou numa mensagem · "Copiar caminho: /home/dev/projetos/infra" |
| 16,4–22,0 s | 3. Resultado | mesma câmera | o ícone vira visto (16,2 s); contorno verde; rótulo com visto desenhado | Pronto, já pode colar / o ícone vira um visto · ✓ "Caminho copiado" |
| 22,0–29,0 s | 4. No celular | topo do print do celular | o cartão troca para o celular; contorno no ícone de copiar ao lado do menu (23,2 s); toque (26,6 s); o ícone vira visto (27,0 s) | No celular, o mesmo ícone / fica no topo, ao lado do menu · "Copiar caminho: /home/dev/projetos/infra"; ✓ "Caminho copiado" |
| 29,0–37,0 s | 5. Caminho inteiro | topo, depois zoom na gaveta (32,5 s) | contorno no menu (29,6 s); toque (31,2 s); máscara abre a gaveta (31,6 s); contorno no caminho (33,4 s) | Leia o caminho inteiro / ele é a primeira linha do menu · "Abrir lista de projetos"; "/home/dev/projetos/infra" |
| 37,0–42,0 s | Fechamento | — | o cartão sai; círculo verde salta (`back_out`); o visto se desenha; a frase sobe; 1 s parado no fim | **O caminho da pasta, / em um clique** / no topo, no computador e no celular |
