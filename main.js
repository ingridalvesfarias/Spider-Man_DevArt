/* ==========================================================================
   Spider-Man — Um Novo Dia
   Animações de rolagem com GSAP.

   - ScrollSmoother  → rolagem suave da página inteira
   - ScrollTrigger   → a Hero fica pinnada enquanto a animação acontece
   - SplitText       → troca de sinopse letra a letra, em ordem aleatória

   A Hero fica pinnada durante dois atos, os dois na MESMA timeline:

     ATO 1 → a sequência de frames roda no .stage enquanto as três sinopses
             se trocam letra a letra. As duas animações ocupam o ato inteiro,
             de 0 a ACT_1, então têm exatamente o mesmo início e o mesmo fim.

     ATO 2 → uma máscara preta abre do centro e revela o trailer, empurrando
             o logo para a esquerda e a sinopse para a direita.
   ========================================================================== */

gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText);

// ScrollSmoother -> suave rolagem
/* ==========================================================================
   1 — ROLAGEM SUAVE
   ========================================================================== */
ScrollSmoother.create({
  wrapper: "#smooth-wrapper",
  content: "#smooth-content",
  smooth: 2,          // segundos que a página leva para "alcançar" a rolagem
  effects: true,
  normalizeScroll: true
});


/* ==========================================================================
        2 — SEQUÊNCIA DE FRAMES (o "vídeo" do plano de fundo do .stage)
   ========================================================================== */
const FRAME_COUNT = 59;
const LAST_FRAME = FRAME_COUNT - 1;

/* O enquadramento vertical repete o antigo background-position: 50% 66.9% */
const FOCUS_X = 0.5;
const FOCUS_Y = 0.669;

const canvas = document.querySelector(".stage__canvas");
const ctx = canvas.getContext("2d", { alpha: false });

/* Objeto tweenado pelo GSAP. Guarda um valor fracionário (ex.: 12.4) para que
   dê pra fazer o crossfade entre dois frames vizinhos — é isso que deixa a
   reprodução suave mesmo com só 59 imagens. */
const playhead = { frame: 0 };

const frames = [];
for (let i = 1; i <= FRAME_COUNT; i++) {
  const img = new Image();
  img.src = `assets/frames/ezgif-frame-${String(i).padStart(3, "0")}.jpg`;
  /* redesenha assim que cada imagem chega, para o canvas nunca ficar vazio */
  img.addEventListener("load", render, { once: true });
  frames.push(img);
}

/* Desenha a imagem cobrindo o canvas (equivalente a background-size: cover) */
function drawCover(img, alpha) {
  if (!img || !img.naturalWidth) return;

  const cw = canvas.width;
  const ch = canvas.height;
  const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;

  ctx.globalAlpha = alpha;
  ctx.drawImage(img, (cw - w) * FOCUS_X, (ch - h) * FOCUS_Y, w, h);
  ctx.globalAlpha = 1;
}

function render() {
  if (!canvas.width || !canvas.height) return;

  const i = Math.min(Math.floor(playhead.frame), LAST_FRAME);
  const frac = playhead.frame - i;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawCover(frames[i], 1);

  /* mistura o frame seguinte por cima, na proporção da fração */
  if (frac > 0.001 && i < LAST_FRAME) drawCover(frames[i + 1], frac);
}

/* O canvas é dimensionado em CSS (100% do .stage); aqui ajustamos o buffer
   interno para a densidade de pixels da tela. */
function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();

  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);

  render();
}


/* ==========================================================================
              3 — TIMELINE MESTRE: frames + troca de textos
   ========================================================================== */

/* Durações em "unidades de timeline". O valor absoluto não importa (o scrub
   normaliza tudo), elas só servem para posicionar uma coisa em relação à
   outra. A Hero fica pinnada durante as duas fases.

     ATO 1 → sequência de frames + troca das três sinopses
     ATO 2 → máscara preta abre do centro e revela o trailer,
             empurrando o logo e a sinopse para os lados

   SCROLL_PER_UNIT converte tudo em distância de rolagem: 15 unidades a 40%
   da altura da tela = 600% (seis telas de rolagem com a Hero travada). */
const ACT_1 = 10;
const ACT_2 = 5;
const TL_DURATION = ACT_1 + ACT_2;
const SCROLL_PER_UNIT = 40;

/* Quanto tempo cada letra leva para sumir/aparecer... */
const CHAR_FADE = 0.5;
/* ...e em quanto tempo o sorteio das letras se espalha (stagger total). */
const CHAR_SPREAD = 1.5;

/* Duração de um bloco completo de fade (última letra termina aqui) */
const FADE_BLOCK = CHAR_FADE + CHAR_SPREAD;
/* O texto que entra começa antes de o anterior sumir por completo */
const OVERLAP = FADE_BLOCK * 0.6;

const textEls = gsap.utils.toArray(".movie__desc");
const textBox = document.querySelector(".movie__texts");
const title = document.querySelector(".movie__title");
const badge = document.querySelector(".scroll-badge");
const ring = document.querySelector(".scroll-badge__ring");
const stage = document.querySelector(".stage");
const reveal = document.querySelector(".reveal");

let splits = [];
let master = null;


/* --------------------------------------------------------------------------
   O EMPURRÃO
   A máscara cresce a partir do centro, então sua borda esquerda está sempre
   em (centro - largura/2). Enquanto essa borda não alcança o logo, nada se
   move; a partir do encontro, o logo anda colado nela. Mesma coisa do outro
   lado com a sinopse. É isso que dá a sensação de estar sendo empurrado.
   -------------------------------------------------------------------------- */
const rv = { w: 0, h: 0 };

const setTitleX = gsap.quickSetter(title, "x", "px");
const setTextsX = gsap.quickSetter(textBox, "x", "px");

let titleGap = 0;   // do centro do .stage até a borda DIREITA do logo
let textsGap = 0;   // do centro do .stage até a borda ESQUERDA da sinopse
let pushPad = 0;   // folga entre a borda da máscara e o conteúdo

/* Medido com x = 0, senão as medidas saem contaminadas pelo próprio empurrão */
function measurePush() {
  const box = stage.getBoundingClientRect();
  const centerX = box.left + box.width / 2;

  titleGap = centerX - title.getBoundingClientRect().right;
  textsGap = textBox.getBoundingClientRect().left - centerX;
  pushPad = box.width * (40 / 1856);   // 40u de respiro

  /* O frame do trailer precisa nascer já com a altura final do .stage — é o
     que faz o vídeo ficar parado enquanto a máscara abre. Medir aqui é mais
     confiável do que calcular em dvh, que varia de navegador para navegador
     (e no mobile muda quando a barra de endereço aparece). */
  reveal.style.setProperty("--frame-h", window.innerHeight + "px");
}

function applyReveal() {
  reveal.style.width = rv.w + "px";
  reveal.style.height = rv.h + "px";

  const half = rv.w / 2 + pushPad;
  setTitleX(-Math.max(0, half - titleGap));
  setTextsX(Math.max(0, half - textsGap));
}


/* --------------------------------------------------------------------------
   PLAYER
   Dois modos: "prévia" (mudo, em loop, com overlay — o que roda enquanto a
   máscara abre) e "assistindo" (do começo, com som e com os controles).
   -------------------------------------------------------------------------- */
const player = (() => {
  const root = document.querySelector(".player");
  const frame = document.querySelector(".reveal__frame");
  const video = document.querySelector(".reveal__video");
  const overlay = document.querySelector(".reveal__overlay");

  const bigBtn = root.querySelector(".player__big");
  const toggle = root.querySelector(".player__toggle");
  const seek = root.querySelector(".player__seek");
  const fill = root.querySelector(".player__fill");
  const nowEl = root.querySelector(".player__now");
  const totalEl = root.querySelector(".player__total");
  const muteBtn = root.querySelector(".player__mute");
  const fullBtn = root.querySelector(".player__full");

  let watching = false;
  let seeking = false;

  const fmt = s => {
    if (!isFinite(s) || s < 0) return "0:00";
    return Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  };

  /* ---------- modos ---------- */
  function preview() {
    video.loop = true;
    video.muted = true;
    video.currentTime = 0;
    video.play().catch(() => { });   // navegador pode recusar; mudo costuma passar
  }

  function reset() {
    if (!watching) return;
    watching = false;

    root.classList.remove("is-playing", "is-paused", "is-muted");
    preview();
    gsap.to(overlay, { opacity: 1, duration: .3, overwrite: true });
  }

  function watch() {
    watching = true;

    root.classList.add("is-playing");
    root.classList.remove("is-paused", "is-muted");

    video.loop = false;
    video.muted = false;
    video.currentTime = 0;      // volta do início, como pedido
    video.play().catch(() => { });

    gsap.to(overlay, { opacity: 0, duration: .4, overwrite: true });
  }

  function setReady(open) { root.classList.toggle("is-ready", open); }

  /* ---------- progresso ---------- */
  function sync() {
    const d = video.duration;
    const p = (isFinite(d) && d > 0) ? video.currentTime / d : 0;

    fill.style.width = (p * 100) + "%";
    nowEl.textContent = fmt(video.currentTime);
    seek.setAttribute("aria-valuenow", Math.round(p * 100));
  }

  function seekToX(clientX) {
    if (!isFinite(video.duration)) return;
    const r = seek.getBoundingClientRect();
    video.currentTime = gsap.utils.clamp(0, 1, (clientX - r.left) / r.width) * video.duration;
    sync();
  }

  /* ---------- eventos ---------- */
  bigBtn.addEventListener("click", watch);

  toggle.addEventListener("click", () => {
    if (video.ended) video.currentTime = 0;
    video.paused ? video.play() : video.pause();
  });

  video.addEventListener("play", () => root.classList.remove("is-paused"));
  video.addEventListener("pause", () => { if (watching) root.classList.add("is-paused"); });
  video.addEventListener("ended", () => root.classList.add("is-paused"));
  video.addEventListener("timeupdate", () => { if (!seeking) sync(); });

  function readMeta() {
    totalEl.textContent = fmt(video.duration);
    sync();
  }
  video.addEventListener("loadedmetadata", readMeta);
  video.addEventListener("durationchange", readMeta);
  /* Se o vídeo veio do cache, "loadedmetadata" já pode ter passado antes
     daqui — nesse caso lemos a duração na hora. */
  if (video.readyState >= 1) readMeta();

  seek.addEventListener("pointerdown", e => {
    seeking = true;
    seek.setPointerCapture(e.pointerId);
    seekToX(e.clientX);
  });
  seek.addEventListener("pointermove", e => { if (seeking) seekToX(e.clientX); });
  seek.addEventListener("pointerup", e => {
    seeking = false;
    seek.releasePointerCapture(e.pointerId);
  });

  seek.addEventListener("keydown", e => {
    const step = e.key === "ArrowLeft" ? -5 : e.key === "ArrowRight" ? 5 : 0;
    if (!step || !isFinite(video.duration)) return;
    e.preventDefault();
    video.currentTime = gsap.utils.clamp(0, video.duration, video.currentTime + step);
    sync();
  });

  muteBtn.addEventListener("click", () => {
    video.muted = !video.muted;
    root.classList.toggle("is-muted", video.muted);
    muteBtn.setAttribute("aria-label", video.muted ? "Ativar som" : "Desativar som");
  });

  fullBtn.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else frame.requestFullscreen().catch(() => { });
  });

  /* Enquanto o player está aberto, a barra de espaço deve pausar o trailer
     em vez de rolar a página. */
  root.addEventListener("keydown", e => {
    if (e.key === " " && watching) { e.preventDefault(); toggle.click(); }
  });

  preview();

  return { reset, setReady };
})();


function buildTimeline() {
  /* --- limpa o que existir de uma execução anterior (resize) --- */
  if (master) {
    if (master.scrollTrigger) master.scrollTrigger.kill(true);
    master.kill();
    master = null;
  }
  splits.forEach(s => s.revert());

  /* --- quebra os três parágrafos em letras --- */
  splits = textEls.map(el => SplitText.create(el, {
    type: "words,chars",   // quebra por palavras também: preserva o wrap do texto
    aria: "auto"           // leitores de tela continuam lendo o texto original
  }));

  /* --- estado inicial: só o primeiro texto visível --- */
  gsap.set(textEls, { opacity: 1 });
  gsap.set(splits[0].chars, { opacity: 1 });
  gsap.set([...splits[1].chars, ...splits[2].chars], { opacity: 0 });
  gsap.set(textBox, { color: "rgba(0, 0, 0, 0.9)" });
  gsap.set(ring, { filter: "invert(0)" });
  gsap.set(badge, { opacity: 1 });

  /* --- estado inicial do ato 2 --- */
  gsap.set([title, textBox], { x: 0 });
  measurePush();
  rv.w = 0;
  rv.h = 0;
  applyReveal();
  player.reset();

  /* --- a timeline --- */
  master = gsap.timeline({
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "+=" + (TL_DURATION * SCROLL_PER_UNIT) + "%",
      pin: true,
      scrub: 1,             // 1s de defasagem: acompanha a rolagem com inércia
      invalidateOnRefresh: true,

      /* o botão de play só fica clicável com a máscara aberta; sair da Hero
         (rolando pra cima ou pra baixo) devolve o trailer ao modo prévia,
         para não deixar o áudio tocando fora da tela */
      onUpdate: self => {
        const open = self.progress > 0.99;
        player.setReady(open);
        if (!open) player.reset();
      },
      onLeave: () => player.reset(),
      onLeaveBack: () => player.reset()
    }
  });

  /* 3.1 — Frames: do primeiro ao último, cobrindo o ato 1 inteiro */
  master.to(playhead, {
    frame: LAST_FRAME,
    duration: ACT_1,
    ease: "none",
    onUpdate: render
  }, 0);

  /* 3.2 — Troca de textos, letra a letra e em ordem aleatória.
     Posições calculadas para o 1º fade começar em 0 e o último terminar
     exatamente em ACT_1 — mesmo início e mesmo fim dos frames. */
  const fadeOut = (chars, at) => master.to(chars, {
    opacity: 0,
    duration: CHAR_FADE,
    ease: "power1.out",
    stagger: { amount: CHAR_SPREAD, from: "random" }
  }, at);

  const fadeIn = (chars, at) => master.to(chars, {
    opacity: 1,
    duration: CHAR_FADE,
    ease: "power1.in",
    stagger: { amount: CHAR_SPREAD, from: "random" }
  }, at);

  const in3Start = ACT_1 - FADE_BLOCK;   // último bloco encosta no fim do ato 1
  const out2Start = in3Start - OVERLAP;

  fadeOut(splits[0].chars, 0);
  fadeIn(splits[1].chars, OVERLAP);
  fadeOut(splits[1].chars, out2Start);
  fadeIn(splits[2].chars, in3Start);

  /* 3.3 — Legibilidade.
     A sequência começa com fundo branco e termina em preto, então a sinopse
     preta e o selo circular preto sumiriam no fim. Os dois trechos abaixo
     acompanham essa virada — e cada um no seu tempo, porque as duas regiões
     do frame escurecem em momentos diferentes (medido nos próprios frames):

       - atrás da sinopse: claro até ~43%, escuro a partir de ~50%
       - atrás do selo:    claro até ~62%, escuro a partir de ~78%

     As duas viradas são curtas de propósito: no meio de um crossfade a arte
     fica cinza, que é justamente o pior contraste. Quanto mais rápida a
     passagem, menos tempo nesse meio-termo.

     O logo do filme não entra aqui: é uma arte colorida (vermelho/azul/dourado)
     que continua legível nos dois fundos. */
  master.to(textBox, {
    color: "rgba(255, 255, 255, 0.92)",
    ease: "none",
    duration: ACT_1 * 0.07
  }, ACT_1 * 0.44);

  master.to(ring, {
    filter: "invert(1)",
    ease: "none",
    duration: ACT_1 * 0.08
  }, ACT_1 * 0.68);


  /* ------------------------------------------------------------------------
     ATO 2 — a máscara abre e revela o trailer
     ------------------------------------------------------------------------ */

  /* 3.4 — O selo "role a página" sai antes da máscara passar por cima dele */
  master.to(badge, {
    opacity: 0,
    ease: "power1.out",
    duration: ACT_2 * 0.22
  }, ACT_1);

  /* 3.5 — Primeiro a altura (vira uma faixa horizontal saindo do centro)... */
  master.to(rv, {
    h: window.innerHeight,
    ease: "power2.out",
    duration: ACT_2 * 0.28,
    onUpdate: applyReveal
  }, ACT_1);

  /* ...depois a largura, que é o que empurra o logo e a sinopse.
     Termina exatamente no fim da timeline. */
  master.to(rv, {
    w: window.innerWidth,
    ease: "power2.inOut",
    duration: ACT_2 * 0.78,
    onUpdate: applyReveal
  }, ACT_1 + ACT_2 * 0.22);

  /* 3.6 — Com a máscara aberta, entra o botão de play */
  master.to(".player__big", {
    opacity: 1,
    scale: 1,
    ease: "back.out(2)",
    duration: ACT_2 * 0.16
  }, TL_DURATION - ACT_2 * 0.16);
}


/* ==========================================================================
   4 — SEÇÃO ELENCO
   A seção fica pinnada enquanto os cinco atores se revezam. Cada troca move
   três coisas ao mesmo tempo: a foto (revelada de cima para baixo), o nome
   na esquerda e a barra de progresso com a aranha.
   ========================================================================== */
const CAST_DURATION = 10;

const castSection = document.querySelector(".cast");
const castMedia = document.querySelector(".cast__media");
const castList = document.querySelector(".cast__list");
const castFill = document.querySelector(".cast__fill");
const castSpider = document.querySelector(".cast__spider");

const shots = gsap.utils.toArray(".cast__shot");
const slides = gsap.utils.toArray(".cast__slide");
const castItems = gsap.utils.toArray(".cast__item");

const STOPS = shots.length;

/* Posição (0..1) do centro de cada nome dentro da lista. É o que faz a aranha
   parar exatamente na altura do nome ativo, sem número mágico nenhum. */
let stopPositions = [];
let castUnit = 1;          // 1u em px, para os deslocamentos do crossfade
let castTl = null;

const pick = { t: 0 };

function measureCast() {
  castUnit = castSection.clientWidth / 1920;

  /* A imagem precisa nascer com a altura final: quem cresce é a máscara */
  castMedia.style.setProperty("--media-h", castMedia.clientHeight + "px");

  const listBox = castList.getBoundingClientRect();
  stopPositions = castItems.map(li => {
    const b = li.getBoundingClientRect();
    return (b.top + b.height / 2 - listBox.top) / listBox.height;
  });
}

function applyPick() {
  const p = gsap.utils.interpolate(stopPositions, pick.t) * 100;

  castFill.style.height = p + "%";
  castSpider.style.top = p + "%";

  /* o nome mais próximo é o ativo — o CSS já faz a transição de cor */
  const active = Math.round(pick.t * (STOPS - 1));
  castItems.forEach((li, i) => {
    li.classList.toggle("cast__item--active", i === active);
    if (i === active) li.setAttribute("aria-current", "true");
    else li.removeAttribute("aria-current");
  });
}

function buildCast() {
  if (castTl) {
    if (castTl.scrollTrigger) castTl.scrollTrigger.kill(true);
    castTl.kill();
    castTl = null;
  }

  measureCast();

  /* --- estado inicial: primeira foto inteira, primeiro nome visível --- */
  gsap.set(shots[0], { height: "100%" });
  gsap.set(shots.slice(1), { height: "0%" });
  gsap.set(slides[0], { opacity: 1, y: 0 });
  gsap.set(slides.slice(1), { opacity: 0 });

  pick.t = 0;
  applyPick();

  castTl = gsap.timeline({
    scrollTrigger: {
      trigger: ".cast",
      start: "top top",
      end: "+=" + (CAST_DURATION * SCROLL_PER_UNIT) + "%",
      pin: true,
      scrub: true,
      invalidateOnRefresh: true
    }
  });

  /* Reserva a duração total. Sem isto a timeline terminaria junto com a última
     troca (a duração de uma timeline é a do seu conteúdo), e o respiro do fim
     simplesmente não existiria. */
  castTl.to({}, { duration: CAST_DURATION }, 0);

  /* Um respiro no começo e no fim, e as quatro trocas distribuídas no meio */
  const HOLD = CAST_DURATION * 0.10;
  const step = (CAST_DURATION - HOLD * 2) / (STOPS - 1);
  const TRANS = step * 0.55;            // o resto de cada trecho é pausa
  const SHIFT = 18 * castUnit;          // deslocamento vertical do crossfade

  for (let k = 1; k < STOPS; k++) {
    const at = HOLD + (k - 1) * step;

    /* 4.1 — a foto nova desce por cima da anterior */
    castTl.fromTo(shots[k],
      { height: "0%" },
      { height: "100%", ease: "power2.inOut", duration: TRANS },
      at);

    /* 4.2 — o nome anterior sobe e some, o novo entra por baixo */
    castTl.to(slides[k - 1], {
      opacity: 0,
      y: -SHIFT,
      ease: "power1.in",
      duration: TRANS * 0.45
    }, at);

    castTl.fromTo(slides[k],
      { opacity: 0, y: SHIFT },
      { opacity: 1, y: 0, ease: "power2.out", duration: TRANS * 0.6 },
      at + TRANS * 0.4);

    /* 4.3 — a barra preenche e a aranha desce até o próximo nome */
    castTl.to(pick, {
      t: k / (STOPS - 1),
      ease: "power2.inOut",
      duration: TRANS,
      onUpdate: applyPick
    }, at);
  }
}


/* ==========================================================================
   5 — BOOT E RESIZE
   ========================================================================== */
resizeCanvas();
buildTimeline();
buildCast();

/* As fontes chegam depois do primeiro paint e mudam a quebra de linha:
   refaz o split (e as medidas do elenco) para tudo cair no lugar certo. */
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    buildTimeline();
    buildCast();
    ScrollTrigger.refresh();
  });
}

/* Só refaz o split quando a LARGURA muda: no mobile, a barra de endereço
   entrando e saindo altera a altura o tempo todo e não deve rebuildar nada.
   A altura da foto, essa sim, precisa ser reescrita em qualquer resize. */
let lastWidth = window.innerWidth;
let resizeTimer;

// window.addEventListener("resize", () => {
//   resizeCanvas();
//   castMedia.style.setProperty("--media-h", castMedia.clientHeight + "px");

//   if (window.innerWidth === lastWidth) return;
//   lastWidth = window.innerWidth;

//   clearTimeout(resizeTimer);
//   resizeTimer = setTimeout(() => {
//     buildTimeline();
//     buildCast();
//     ScrollTrigger.refresh();
//   }, 250);
// });
