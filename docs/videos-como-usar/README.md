# Vídeos "como usar" do DevDA

Série de 7 vídeos curtos (9:16, pt-BR) para a página `/ajuda` do portal. Os vídeos são feitos com o plugin `motion@dataagile`, pela skill `/motion:video`.

## Situação

| # | Pasta | Situação | O que falta |
|---|---|---|---|
| 1 | `devda-copiar-caminho` | pronto (mp4 + poster) | nada |
| 2 | `devda-arquivos` | pronto | nada |
| 3 | `devda-arquivos-modificados` | pronto | nada |
| 4 | `devda-feedback` | roteiro e prévia (`previa/index.html`, 9 prints) | aprovação do João e render |
| 5 | `devda-precisa-de-voce` | roteiro e prévia (`previa/index.html`, 12 quadros) | aprovação do João e render |
| 6 | `devda-celular` | roteiro e prévia (`previa/index.html`, 13 quadros) | aprovação do João e render |
| 7 | `devda-barra-lateral` | roteiro e prévia (`previa/index.html`, 11 quadros) | aprovação do João e render |

Os vídeos 1 a 3 já foram entregues à sessão do portal (branch `docs/ajuda-videos` do herdr-portal), que vai publicar os 7 de uma vez. Quando cada vídeo novo ficar pronto, mandar o `.mp4` e o `-poster.webp` para lá.

## Regras

- Cada passo diz três coisas: o que é, para que serve e qual o resultado. O texto é em pt-BR claro e usa o rótulo exato que aparece na tela.
- Só dados fictícios. O `prep.py` troca os textos da demo por textos em pt-BR.
- A palavra "herdr" não pode aparecer. A marca é DevDA e o ícone é `<DA/>`.
- **Gate:** a prévia (prints + roteiro) é aprovada pelo João antes do render.

## Como capturar

Rodar tudo da raiz do fork, depois do `bun install`:

```sh
export CHROME_PATH=/caminho/do/chrome   # por exemplo, o Chromium do Playwright
python3 docs/videos-como-usar/_captura/prep.py /tmp/devda-demo                                            # demo com textos em pt-BR
bun docs/videos-como-usar/_captura/shoot-precisa.ts docs/videos-como-usar/devda-precisa-de-voce/prints /tmp/devda-demo
python3 docs/videos-como-usar/_captura/previa-index.py devda-precisa-de-voce "Precisa de você"                    # gera previa/index.html
```

- Os vídeos 5 e 6 usam `prep-ptbr.py` no lugar do `prep.py`: ele traduz as conversas e a pergunta "Permitir o comando?". O vídeo 7 usa `prep-barra.py`, que roda o `prep-ptbr.py` e acrescenta um segundo PC fictício ("notebook").
- Na VM sem as libs gráficas (sem sudo), use o `chrome-headless-shell` do Playwright com as libs baixadas por `apt-get download` + `dpkg-deb -x` em `~/.local/share/devda-chrome-libs/root`, e `export LD_LIBRARY_PATH=~/.local/share/devda-chrome-libs/root/usr/lib/x86_64-linux-gnu`.
- O script de captura de cada vídeo é `shoot-<nome>.ts`.
- O `prep-<nome>.py` acrescenta as trocas de texto específicas daquele vídeo.
- `bun _captura/serve-videos.ts` serve esta pasta com suporte a range, o que permite ver os vídeos no Safari do iPhone.
- Os scripts acham o fork sozinhos, três pastas acima de `_captura`. Para usar outro checkout, defina `DEVDA_REPO`.
- O `roteiro.py` de cada pasta é a entrada da skill `/motion:video`, e o `roteiro.md` é o texto que o João aprova.
