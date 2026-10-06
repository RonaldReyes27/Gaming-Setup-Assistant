'use strict';
/* ==========================================================
   Gaming Setup Assistant · lógica
   Idea simple: cada función hace UNA sola tarea
   (así el código es fácil de leer y de cambiar: principio S de SOLID).

   Flujo:  detectar PC -> pedir juego a la API -> comparar -> mostrar
   ========================================================== */

/* ---------- PARTE 1: TABLAS DE PUNTAJE ---------- */
// Puntaje relativo de cada GPU (GTX 1060 ≈ 100). Más alto = más potente.
const GPU_TABLE = [
  ['gt 1030',22],['gtx 650',25],['gtx 660',40],['gtx 750 ti',40],['gtx 760',48],['gtx 770',55],['gtx 780',66],
  ['gtx 950',48],['gtx 960',55],['gtx 970',85],['gtx 980',100],['gtx 1050 ti',62],['gtx 1050',50],['gtx 1060',100],
  ['gtx 1070',145],['gtx 1080',190],['gtx 1650',85],['gtx 1660 super',140],['gtx 1660 ti',145],['gtx 1660',130],
  ['rtx 2060',170],['rtx 2070',210],['rtx 2080',260],['rtx 3050 ti',140],['rtx 3050',150],['rtx 3060 ti',270],
  ['rtx 3060',215],['rtx 3070',330],['rtx 3080',420],['rtx 3090',480],['rtx 4060',260],['rtx 4070',370],
  ['rtx 4080',540],['rtx 4090',700],['hd 7870',60],['r9 270',50],['r9 280',60],['r9 290',95],['rx 470',105],
  ['rx 480',125],['rx 570',105],['rx 580',125],['rx 5500',100],['rx 5600',170],['rx 5700',240],['rx 6600',230],
  ['rx 6700',330],['rx 6800',420],['rx 7600',260],['vega',28],['radeon graphics',28],['iris xe',30],
  ['uhd graphics',14],['uhd',14],['hd graphics',10],['intel hd',10]
];
// Ordenamos de nombre largo a corto para que "rtx 3050 ti" se encuentre antes que "rtx 3050".
GPU_TABLE.sort((a, b) => b[0].length - a[0].length);

// Para CPU: puntaje = valor de la generación x multiplicador de la gama (i3/i5/i7/i9, Ryzen 3/5/7/9).
const TIER = { 3: 1, 5: 1.3, 7: 1.7, 9: 2.2 };
const INTEL_GEN = { 2:25, 3:30, 4:36, 5:40, 6:46, 7:50, 8:68, 9:72, 10:78, 11:95, 12:125, 13:140, 14:145 };
const RYZEN_SERIES = { 1:50, 2:60, 3:75, 4:80, 5:95, 6:105, 7:120, 8:130, 9:140 };

// Textos de cada estado (icono + palabra, nunca solo color).
const STATUS = {
  ok:  { icon: '✅', text: 'Cumple lo recomendado', cls: 'st-ok' },
  min: { icon: '⚠️', text: 'Cumple el mínimo',     cls: 'st-min' },
  bad: { icon: '❌', text: 'No cumple el mínimo',  cls: 'st-bad' },
  unk: { icon: '❔', text: 'No verificable',        cls: 'st-unk' }
};

/* ---------- PARTE 2: DETECTAR EL HARDWARE REAL ---------- */
// GPU: WebGL deja leer el nombre real de la tarjeta de video.
function detectGpu() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return '';
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  if (!info) return '';
  const raw = gl.getParameter(info.UNMASKED_RENDERER_WEBGL);
  // Limpiamos texto técnico: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 Ti Direct3D11 ...)"
  return raw.replace('ANGLE (', '').replace(/Direct3D.*$/, '').replace(/OpenGL.*$/, '')
            .replace(/NVIDIA,|AMD,|Intel,/g, '').replace(/\(R\)|\(TM\)|[(),]/gi, ' ')
            .replace(/\s+/g, ' ').trim();
}

// Hilos del CPU y RAM (el navegador reporta la RAM con un máximo de 8 GB; Firefox/Safari no la dan).
function detectHardware() {
  return {
    gpu: detectGpu(),
    threads: navigator.hardwareConcurrency || null,
    ram: navigator.deviceMemory || null
  };
}

/* ---------- PARTE 3: CONVERTIR NOMBRES EN PUNTAJES ---------- */
function scoreGpu(text) {
  if (!text) return null;
  // Algunos juegos piden "GTX 960 / AMD R9 280": separamos y usamos la opción más baja.
  const options = text.toLowerCase().split(/\/| or |,/);
  const scores = [];
  for (const option of options) {
    for (const [model, score] of GPU_TABLE) {
      if (option.includes(model)) { scores.push(score); break; }
    }
  }
  return scores.length ? Math.min(...scores) : null;
}

function scoreCpu(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  // Intel: "i5-8400" -> gama 5, generación 8
  const intel = t.match(/i([3579])[\s-]*(\d{4,5})([a-z]*)/);
  if (intel) {
    const digits = intel[2];
    const gen = digits.length === 5 ? Number(digits.slice(0, 2)) : Number(digits[0]);
    const mobile = intel[3].includes('u') ? 0.6 : 1;           // los "U" son de bajo consumo
    return Math.round((INTEL_GEN[gen] || 60) * TIER[intel[1]] * mobile);
  }
  // AMD: "ryzen 5 5600h" -> gama 5, serie 5
  const ryzen = t.match(/ryzen\s*([3579])\s*(\d)\d{3}([a-z]*)/);
  if (ryzen) {
    const mobile = ryzen[3].includes('u') ? 0.6 : 1;
    return Math.round(RYZEN_SERIES[ryzen[2]] * TIER[ryzen[1]] * mobile);
  }
  return null; // modelo no reconocido
}

/* ---------- PARTE 4: API (RAWG) ---------- */
// Busca el juego y luego pide su detalle, donde vienen los requisitos de PC.
async function getGameFromApi(name, key) {
  const base = 'https://api.rawg.io/api';
  const search = await fetch(`${base}/games?search=${encodeURIComponent(name)}&page_size=1&key=${key}`);
  if (!search.ok) throw new Error('API_FAIL');
  const found = (await search.json()).results[0];
  if (!found) throw new Error('NOT_FOUND');

  const detail = await fetch(`${base}/games/${found.id}?key=${key}`);
  if (!detail.ok) throw new Error('API_FAIL');
  const game = await detail.json();

  const pc = game.platforms.find(p => p.platform.slug === 'pc');
  const req = (pc && pc.requirements) || {};
  if (!req.minimum && !req.recommended) throw new Error('NO_REQS');
  return { name: game.name, image: game.background_image, minimum: req.minimum || '', recommended: req.recommended || '' };
}

// Saca CPU, GPU y RAM del texto de requisitos. Ej: "Processor: i5-8400 Memory: 8 GB RAM Graphics: GTX 1060"
function readRequirements(text) {
  const stops = 'OS|Processor|CPU|Memory|RAM|Graphics|Video Card|Storage|Hard Drive|DirectX|Additional Notes|Sound Card|Network';
  const get = labels => {
    const regex = new RegExp(`(?:${labels})\\s*:\\s*([\\s\\S]*?)(?=(?:${stops})\\s*:|$)`, 'i');
    const match = text.replace(/<[^>]+>/g, ' ').match(regex);
    return match ? match[1].trim() : '';
  };
  const ramMatch = get('Memory|RAM').match(/(\d+)\s*gb/i);
  return { cpu: get('Processor|CPU'), gpu: get('Graphics|Video Card'), ram: ramMatch ? Number(ramMatch[1]) : null };
}

/* ---------- PARTE 5: COMPARAR ---------- */
// Compara un componente: devuelve su estado y cuántas veces supera lo recomendado (ratio).
function compare(user, min, rec) {
  if (user == null || min == null) return { status: 'unk', ratio: null };
  const target = Math.max(rec == null ? min * 1.6 : rec, min); // sin recomendado, lo aproximamos
  const status = user >= target ? 'ok' : user >= min ? 'min' : 'bad';
  return { status, ratio: user / target };
}

// Ratio -> satisfacción 0 a 1: 1x lo recomendado = 60 %, 2.5x o más = 100 %.
function satisfaction(ratio) {
  if (ratio < 1) return 0.6 * ratio;
  return 0.6 + 0.4 * Math.min((ratio - 1) / 1.5, 1);
}

function analyze(pc, game) {
  const min = readRequirements(game.minimum);
  const rec = readRequirements(game.recommended);

  const cpu = compare(scoreCpu(pc.cpu), scoreCpu(min.cpu), scoreCpu(rec.cpu));
  const gpu = compare(scoreGpu(pc.gpu), scoreGpu(min.gpu), scoreGpu(rec.gpu));
  const ram = compare(pc.ram, min.ram, rec.ram);

  // Datos para mostrar en pantalla
  cpu.user = pc.cpu || 'No indicada';  cpu.req = [min.cpu, rec.cpu];
  gpu.user = pc.gpu;                   gpu.req = [min.gpu, rec.gpu];
  ram.user = pc.ram + ' GB';           ram.req = [min.ram && min.ram + ' GB', rec.ram && rec.ram + ' GB'];

  // Rendimiento: promedio con pesos (la GPU importa más en juegos).
  const weights = { gpu: 0.55, cpu: 0.30, ram: 0.15 };
  const parts = { cpu, gpu, ram };
  let total = 0, weightSum = 0;
  for (const name in parts) {
    if (parts[name].ratio === null) continue;           // lo que no se pudo verificar no cuenta
    total += weights[name] * satisfaction(parts[name].ratio);
    weightSum += weights[name];
  }
  let percent = weightSum ? Math.round(100 * total / weightSum) : null;
  const anyBad = [cpu, gpu, ram].some(c => c.status === 'bad');
  if (percent !== null && anyBad) percent = Math.min(percent, 40); // un componente débil limita todo

  const preset = percent === null ? '—' : percent >= 90 ? 'Ultra' : percent >= 75 ? 'Alta'
               : percent >= 55 ? 'Media' : percent >= 40 ? 'Baja' : 'No recomendado';
  const r = gpu.ratio;
  const resolution = r === null ? '—' : r >= 4 ? '4K' : r >= 2.6 ? '1440p' : r >= 1.2 ? '1080p' : '720p';
  return { cpu, gpu, ram, percent, preset, resolution };
}

/* ---------- PARTE 6: MOSTRAR EN PANTALLA ---------- */
const $ = id => document.getElementById(id);

// Los textos vienen de internet, así que los "escapamos" antes de ponerlos en el HTML.
function safe(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : text;
  return div.innerHTML;
}

function componentHtml(label, c) {
  const s = STATUS[c.status];
  const [min, rec] = c.req;
  return `
    <div class="row">
      <span class="icon" aria-hidden="true">${s.icon}</span>
      <div>
        <h3>${label} · <span class="${s.cls}">${s.text}</span></h3>
        <p>Tu equipo: ${safe(c.user)}</p>
        <p>Mínimo: ${safe(min || 'sin dato')} · Recomendado: ${safe(rec || 'sin dato')}</p>
      </div>
    </div>`;
}

function showResult(game, r) {
  const level = r.percent === null ? 'bad' : r.percent >= 75 ? 'ok' : r.percent >= 55 ? 'min' : 'bad';
  $('result').innerHTML = `
    <div class="game-head">
      ${game.image ? `<img src="${safe(game.image)}" alt="">` : ''}
      <div><h2>${safe(game.name)}</h2><span class="source">Fuente: RAWG API</span></div>
    </div>
    <div class="rows">
      ${componentHtml('CPU', r.cpu)}${componentHtml('GPU', r.gpu)}${componentHtml('RAM', r.ram)}
    </div>
    <div class="perf-label"><span>Rendimiento estimado</span><span>${r.percent === null ? '—' : r.percent + '%'}</span></div>
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${r.percent || 0}">
      <span class="${level}" style="width:${r.percent || 0}%"></span>
    </div>
    <div class="facts">
      <div class="fact"><span>Configuración recomendada</span><b>${r.preset}</b></div>
      <div class="fact"><span>Resolución</span><b>${r.resolution}</b></div>
    </div>`;
}

function showError(text) {
  $('result').innerHTML = `<p class="msg">${text}</p>`;
}

const ERRORS = {
  NOT_FOUND: 'No encontré ese juego. Revisa el nombre e intenta de nuevo.',
  NO_REQS: 'Este juego no tiene requisitos de PC publicados en RAWG. Prueba con otro.',
  API_FAIL: 'No se pudo consultar la API. Revisa tu clave y tu conexión a internet.'
};

/* ---------- PARTE 7: EVENTOS (conecta todo) ---------- */
// Rellena el formulario con lo que detectó el navegador.
function fillForm() {
  const hw = detectHardware();
  if (hw.gpu) $('gpu').value = hw.gpu;
  if (hw.ram) $('ram').value = hw.ram;
  const lines = [
    'GPU: ' + (hw.gpu || 'no se pudo detectar'),
    'Hilos del CPU: ' + (hw.threads || 'no disponible'),
    'RAM reportada: ' + (hw.ram ? hw.ram + ' GB' : 'no disponible en este navegador')
  ];
  $('detected').textContent = 'Detectado: ' + lines.join(' · ');
}

$('form').addEventListener('submit', async event => {
  event.preventDefault();
  const pc = { cpu: $('cpu').value.trim(), gpu: $('gpu').value.trim(), ram: Number($('ram').value) };
  const name = $('game').value.trim();
  const key = $('apikey').value.trim();

  if (!pc.gpu || !pc.ram || !name) return showError('Completa GPU, RAM y juego.');
  if (!key) return showError('Pega tu clave gratuita de RAWG para consultar los requisitos.');
  try { localStorage.setItem('gsa_rawg_key', key); } catch (e) { /* sin almacenamiento */ }

  $('go').disabled = true;
  $('go').textContent = 'Consultando…';
  try {
    const game = await getGameFromApi(name, key);
    showResult(game, analyze(pc, game));
  } catch (error) {
    showError(ERRORS[error.message] || ERRORS.API_FAIL);
  } finally {
    $('go').disabled = false;
    $('go').textContent = 'Analizar mi PC';
  }
});

$('redetect').addEventListener('click', fillForm);

// Al abrir la página: detectar el equipo y recuperar la clave guardada.
fillForm();
try { $('apikey').value = localStorage.getItem('gsa_rawg_key') || ''; } catch (e) { /* ignorar */ }