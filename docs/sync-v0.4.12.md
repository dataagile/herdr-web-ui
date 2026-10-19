# Sync do upstream v0.4.12 — estado de entrega (WIP)

Merge de `devswha/herdr-web-ui` v0.4.12 sobre o fork (que estava na v0.4.1; main `f8bb39eb`), feito por um agente e **não revisado nem testado**. Este commit só preserva o trabalho para o Rodrigo continuar.

## Não publique na frota antes de
1. **Desligar a telemetria por padrão.** `server/telemetry.ts` envia a `herdr-web-ui-telemetry.devswha.workers.dev` e vem ligada (`enabled: true` no estado salvo, depois de um aviso único). Meta: opt-in explícito, respeitando `HERDR_WEB_TELEMETRY` e `DO_NOT_TRACK`, com teste "sem configuração, nenhuma requisição sai". Varrer outras chamadas externas ligadas ao devswha.
2. Resolver a colisão `/api/portal`: o upstream responde `/api/portal` e `/api/portal/*` (`server/index.ts`, funcionalidade "Portal"); o gateway da Data Agile reserva o prefixo inteiro. Preferência da painel-admin: manter o prefixo no gateway e esconder a "Portal" do upstream no fork quando detectar o gateway (`/api/portal/me` autenticado).
3. Decidir o split de painéis: o upstream tem `PaneCanvas` e `/api/pane/split|zoom|swap|resize|focus`, com as mesmas URLs do nosso SplitView (PR #9) e contratos diferentes. Proposta: ficar com o do upstream e manter por cima o "split iniciado com agente" e a versão no rodapé.

## Antes do PR
Rodar a suíte, review em agente novo sem contexto, PR com merge commit, ok do João.
