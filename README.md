# Spider-Man: Um Novo Dia — DevArt

Landing page interativa inspirada no universo do Homem-Aranha. O projeto apresenta uma experiência visual baseada em rolagem, com sequência de imagens no canvas, trailer integrado e seção animada de elenco.

> Projeto conceitual/fã. As marcas e personagens Spider-Man e Marvel pertencem aos seus respectivos detentores de direitos.

## Destaques

- Hero com visual de teia, logo, data de lançamento e chamadas para trailer e ingressos.
- Animação controlada pela rolagem: uma sequência de frames é desenhada em `<canvas>` e sincronizada com textos narrativos.
- Transição que revela o trailer a partir do centro da tela.
- Player próprio com play/pause, barra de progresso, controle de volume e tela cheia.
- Seção de elenco fixada durante a rolagem, com troca de atores, imagens e indicador em forma de aranha.
- Layout dimensionado proporcionalmente ao design de referência e preparado para diferentes larguras de tela.

## Tecnologias

- HTML5
- CSS3
- JavaScript puro
- [GSAP](https://gsap.com/) com ScrollTrigger, ScrollSmoother e SplitText, carregados via CDN

## Estrutura do projeto

```text
Spider-Man_DevArt/
├── assets/
│   ├── frames/             # Sequência de imagens usada no canvas
│   ├── elenco/             # Imagens do elenco
│   ├── trailer.mp4         # Vídeo exibido no player
│   └── ...                 # Logos, SVGs, fontes e imagens de apoio
├── index.html              # Estrutura das seções e do player
├── style.css               # Estilos, responsividade e composição visual
├── main.js                 # Animações GSAP, canvas e controles do vídeo
└── README.md               # Documentação do projeto
```

## Interações

- Role a página para avançar a sequência visual da hero e alternar os textos.
- Continue a rolagem para revelar o trailer.
- Use o botão central para assistir; os controles aparecem após o início do vídeo.
- Na seção **Elenco**, a rolagem alterna as fotos, nomes e personagens.

## Personalização

- Atualize os textos, links e dados do lançamento em `index.html`.
- Troque as imagens em `assets/elenco/` e os textos da lista de elenco para exibir novos personagens.
- Ajuste cores, proporções e pontos de quebra em `style.css`.
- Altere as durações, sequências de frames e comportamento da rolagem em `main.js`.

## Observações

- O projeto depende de conexão com a internet para carregar o GSAP via CDN e a fonte Poppins do Google Fonts.
- Para funcionar corretamente, mantenha a pasta `assets` junto aos arquivos principais.

## 📸 Preview

Acesse: https://spider-man-dev-art.vercel.app/

<img src="./assets/img/imagem do projeto.png" alt="imagem do projeto">