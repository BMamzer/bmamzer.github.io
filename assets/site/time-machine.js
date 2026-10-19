// Time machine: the home page (Grimoire, the present) and /retro/ (Pixel, 1994) link to each other.
// A click plays a short time-travel effect, the other page opens with a matching reveal, and Back works as usual.
// Without JavaScript, or with reduced motion, the button is a plain link. Each page's CSS styles .tm-overlay.

const KEY = 'time-machine'; // sessionStorage: the era the next page should arrive in, read by an inline <head> script
const PAST = 1994;
const PRESENT = new Date().getFullYear();
const root = document.documentElement;
const era = root.dataset.era; // 'present' or 'past'
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const TEXT = {
  present: { leave: `Rewinding to ${PAST}`, arrive: 'Welcome back to the present' },
  past: { leave: `Fast-forward to ${PRESENT}`, arrive: 'Welcome to the 16-bit era' },
};

const wait = ms => new Promise(r => setTimeout(r, ms));
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Runs fn(progress 0..1) every frame for ms milliseconds. */
function tween(ms, fn) {
  return new Promise(resolve => {
    const t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / ms);
      fn(p);
      if (p < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}

function setYear(el, year) {
  el.innerHTML = String(year).split('').map(d => `<span>${d}</span>`).join('');
}

function makeOverlay(kind, year, caption) {
  const el = document.createElement('div');
  el.className = `tm-overlay tm-${kind}`;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<div class="tm-fx"></div><canvas class="tm-cover"></canvas><p class="tm-year"></p><p class="tm-caption"></p>';
  setYear(el.querySelector('.tm-year'), year);
  el.querySelector('.tm-caption').textContent = caption;
  document.body.append(el);
  return el;
}

/** A full-screen canvas split into square cells, for the pixel dissolve. */
function grid(canvas) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.ceil(innerWidth * dpr);
  canvas.height = Math.ceil(innerHeight * dpr);
  const size = Math.ceil(Math.max(canvas.width, canvas.height) / 26);
  const cols = Math.ceil(canvas.width / size);
  const rows = Math.ceil(canvas.height / size);
  const order = [...Array(cols * rows).keys()];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  return { ctx, size, cols, order, w: canvas.width, h: canvas.height };
}

/** Fills (cover) or clears (reveal) the cells in random order: the world turning into, or out of, pixels. */
function dissolve(canvas, ms, reveal) {
  const g = grid(canvas);
  if (reveal) g.ctx.fillRect(0, 0, g.w, g.h);
  let done = 0;
  return tween(ms, p => {
    const to = Math.round(ease(p) * g.order.length);
    for (; done < to; done++) {
      const i = g.order[done];
      const x = (i % g.cols) * g.size;
      const y = Math.floor(i / g.cols) * g.size;
      if (reveal) g.ctx.clearRect(x, y, g.size, g.size); else g.ctx.fillRect(x, y, g.size, g.size);
    }
  });
}

/** Opens a soft-edged hole from the middle of a black canvas, ringed with gold light. */
function circleReveal(canvas, ms) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = (canvas.width = Math.ceil(innerWidth * dpr));
  const h = (canvas.height = Math.ceil(innerHeight * dpr));
  const ctx = canvas.getContext('2d');
  const max = Math.hypot(w, h) / 2 + 40 * dpr;
  return tween(ms, p => {
    const r = Math.max(1, ease(p) * max * 1.25);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-out';
    const hole = ctx.createRadialGradient(w / 2, h / 2, r * 0.7, w / 2, h / 2, r);
    hole.addColorStop(0, '#000');
    hole.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    const glow = ctx.createRadialGradient(w / 2, h / 2, r * 0.82, w / 2, h / 2, r * 1.02);
    glow.addColorStop(0, 'rgba(241,213,144,0)');
    glow.addColorStop(0.6, `rgba(241,213,144,${0.35 * (1 - p)})`);
    glow.addColorStop(1, 'rgba(241,213,144,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  });
}

let busy = false;
let overlay = null;

async function leave(link) {
  busy = true;
  const to = era === 'present' ? 'past' : 'present';
  const from = era === 'present' ? PRESENT : PAST;
  const target = to === 'past' ? PAST : PRESENT;
  overlay = makeOverlay('out', from, TEXT[era].leave);
  const year = overlay.querySelector('.tm-year');
  let shown = from;
  const count = tween(1300, p => {
    const y = Math.round(from + (target - from) * ease(p));
    if (y !== shown) setYear(year, (shown = y));
  });
  await wait(1050);
  await Promise.all([count, dissolve(overlay.querySelector('.tm-cover'), 550, false)]);
  try { sessionStorage.setItem(KEY, to); } catch { /* private mode: the next page just opens without the reveal */ }
  await wait(120);
  location.href = link.href;
}

async function arrive() {
  overlay = makeOverlay('in', era === 'past' ? PAST : PRESENT, TEXT[era].arrive);
  const canvas = overlay.querySelector('.tm-cover');
  const g = canvas.getContext('2d');
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  g.fillRect(0, 0, canvas.width, canvas.height);
  root.classList.remove('tm-arrive');
  const ready = new Promise(resolve => {
    if (root.classList.contains('is-ready')) return resolve();
    const watch = new MutationObserver(() => {
      if (root.classList.contains('is-ready')) { watch.disconnect(); resolve(); }
    });
    watch.observe(root, { attributes: true, attributeFilter: ['class'] });
  });
  await Promise.all([wait(700), Promise.race([Promise.all([ready, document.fonts?.ready]), wait(2200)])]);
  overlay.classList.add('tm-leaving');
  await (era === 'past' ? dissolve(canvas, 650, true) : circleReveal(canvas, 900));
  overlay.remove();
  overlay = null;
}

document.addEventListener('click', e => {
  const link = e.target.closest('a[data-time-machine]');
  if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (reducedMotion.matches) return;
  e.preventDefault();
  if (!busy) leave(link);
});

// Back to this page from the bfcache: drop the half-played effect.
addEventListener('pageshow', e => {
  if (!e.persisted) return;
  overlay?.remove();
  overlay = null;
  busy = false;
});

if (root.classList.contains('tm-arrive')) {
  if (reducedMotion.matches) root.classList.remove('tm-arrive');
  else arrive();
}
