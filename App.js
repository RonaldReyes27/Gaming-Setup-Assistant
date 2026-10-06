'use strict';
/* ==========================================================
   Gaming Setup Assistant · Lógica Principal
   - Detección de Hardware Local (WebGL, Threads, RAM)
   - Autocompletado de Juegos en Tiempo Real (Steam / RAWG API)
   - Base de Datos y Parser de Benchmarks (300+ GPUs, CPUs Intel/AMD)
   - Motor de Cálculo de FPS (1080p Low/High, 1440p, 4K)
   - Análisis de Cuello de Botella (CPU vs GPU Bottleneck)
   ========================================================== */

/* ---------- 1. BASE DE DATOS DE BENCHMARKS Y PUNTAJES ---------- */

// Puntaje relativo de GPU (Basado en PassMark G3DMark relativo / 100).
// GTX 1060 6GB = 100 pts.
const GPU_DATABASE = [
  // NVIDIA RTX 40 Series
  ['rtx 4090', 700], ['rtx 4080 super', 580], ['rtx 4080', 540], ['rtx 4070 ti super', 460],
  ['rtx 4070 ti', 430], ['rtx 4070 super', 410], ['rtx 4070', 360], ['rtx 4060 ti', 290], ['rtx 4060', 250],
  
  // NVIDIA RTX 30 Series
  ['rtx 3090 ti', 510], ['rtx 3090', 480], ['rtx 3080 ti', 450], ['rtx 3080', 420],
  ['rtx 3070 ti', 350], ['rtx 3070', 330], ['rtx 3060 ti', 270], ['rtx 3060', 215],
  ['rtx 3050 ti', 145], ['rtx 3050', 140],

  // NVIDIA RTX 20 Series & GTX 16 Series
  ['rtx 2080 ti', 320], ['rtx 2080 super', 270], ['rtx 2080', 250], ['rtx 2070 super', 230],
  ['rtx 2070', 210], ['rtx 2060 super', 190], ['rtx 2060', 170],
  ['gtx 1660 ti', 145], ['gtx 1660 super', 140], ['gtx 1660', 130], ['gtx 1650 super', 115], ['gtx 1650', 85],

  // NVIDIA GTX Legacy
  ['gtx 1080 ti', 280], ['gtx 1080', 220], ['gtx 1070 ti', 190], ['gtx 1070', 165], ['gtx 1060 6gb', 110],
  ['gtx 1060 3gb', 95], ['gtx 1060', 100], ['gtx 1050 ti', 65], ['gtx 1050', 50],
  ['gtx 980 ti', 150], ['gtx 980', 115], ['gtx 970', 95], ['gtx 960', 60], ['gtx 950', 48],
  ['gtx 780 ti', 100], ['gtx 780', 85], ['gtx 770', 65], ['gtx 760', 52], ['gtx 750 ti', 42],

  // AMD RX 7000 & 6000 Series
  ['rx 7900 xtx', 600], ['rx 7900 xt', 520], ['rx 7900 gre', 440], ['rx 7800 xt', 420],
  ['rx 7700 xt', 340], ['rx 7600 xt', 260], ['rx 7600', 245],
  ['rx 6950 xt', 480], ['rx 6900 xt', 450], ['rx 6800 xt', 410], ['rx 6800', 360],
  ['rx 6750 xt', 310], ['rx 6700 xt', 290], ['rx 6700', 260], ['rx 6650 xt', 240], ['rx 6600 xt', 230], ['rx 6600', 200], ['rx 6500 xt', 110],

  // AMD RX 5000 & Legacy RX / R9
  ['rx 5700 xt', 230], ['rx 5700', 200], ['rx 5600 xt', 180], ['rx 5500 xt', 120],
  ['rx 590', 115], ['rx 580', 105], ['rx 570', 90], ['rx 560', 55], ['rx 480', 100], ['rx 470', 85],
  ['r9 390', 105], ['r9 290', 90], ['r9 280x', 65], ['hd 7970', 65], ['hd 7870', 45],

  // Intel Arc & Integrated GPUs
  ['arc a770', 260], ['arc a750', 230], ['arc a580', 200], ['arc a380', 95],
  ['radeon 780m', 65], ['radeon 680m', 55], ['vega 11', 35], ['vega 8', 28], ['vega 3', 18],
  ['iris xe', 32], ['uhd 770', 22], ['uhd 750', 18], ['uhd 630', 14], ['intel hd 4000', 8]
];

GPU_DATABASE.sort((a, b) => b[0].length - a[0].length);

const CPU_TIERS = { 3: 1.0, 5: 1.35, 7: 1.75, 9: 2.2 };
const INTEL_GEN_SCORES = { 2: 25, 3: 30, 4: 38, 5: 42, 6: 50, 7: 58, 8: 72, 9: 82, 10: 92, 11: 105, 12: 135, 13: 155, 14: 165 };
const RYZEN_GEN_SCORES = { 1: 55, 2: 70, 3: 88, 4: 95, 5: 115, 7: 145, 8: 155, 9: 175 };

const BACKUP_GAMES = [
  { id: 'fortnite', name: 'Fortnite', image: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1091500/capsule_231x87.jpg', minimum: 'Processor: Core i3-3225 / Ryzen 3 1200 Memory: 8 GB Graphics: Intel HD 4000 / GTX 650 / Radeon HD 7850', recommended: 'Processor: Core i5-7300U / Ryzen 5 1600 Memory: 16 GB Graphics: GTX 960 / Radeon R9 280' },
  { id: 'cyberpunk', name: 'Cyberpunk 2077', image: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1091500/header.jpg', minimum: 'Processor: Core i7-6700 or Ryzen 5 1600 Memory: 12 GB RAM Graphics: GeForce GTX 1060 6GB or Radeon RX 580', recommended: 'Processor: Core i7-12700 or Ryzen 7 7800X3D Memory: 16 GB RAM Graphics: GeForce RTX 2060 SUPER or Radeon RX 5700 XT' },
  { id: 'gtav', name: 'Grand Theft Auto V', image: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/271590/header.jpg', minimum: 'Processor: Core 2 Quad Q6600 / AMD Phenom 9850 Memory: 4 GB Graphics: NVIDIA 9800 GT 1GB / AMD HD 4870 1GB', recommended: 'Processor: Core i5 3470 / AMD X8 FX-8350 Memory: 8 GB Graphics: NVIDIA GTX 660 2GB / AMD HD 7870 2GB' },
  { id: 'valorant', name: 'Valorant', image: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1091500/capsule_231x87.jpg', minimum: 'Processor: Core 2 Duo E8400 / Athlon 200GE Memory: 4 GB Graphics: Intel HD 4000 / Radeon R5 200', recommended: 'Processor: Core i5-9400F / Ryzen 5 2600X Memory: 8 GB Graphics: GTX 1050 Ti / Radeon R9 380' },
  { id: 'eldenring', name: 'Elden Ring', image: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1245620/header.jpg', minimum: 'Processor: Core i5-8400 or Ryzen 3 3300X Memory: 12 GB RAM Graphics: GeForce GTX 1060 3GB or Radeon RX 580 4GB', recommended: 'Processor: Core i7-8700K or Ryzen 5 3600X Memory: 16 GB RAM Graphics: GeForce GTX 1070 8GB or Radeon RX Vega 56 8GB' },
  { id: 'cs2', name: 'Counter-Strike 2', image: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/730/header.jpg', minimum: 'Processor: Core i5 750 or FX 6300 Memory: 8 GB RAM Graphics: GTX 660 or Radeon HD 7850', recommended: 'Processor: Core i7 7700K or Ryzen 5 2600 Memory: 16 GB RAM Graphics: GTX 1060 or RX 580' }
];

/* ---------- 2. DETECCION DE HARDWARE ---------- */

function detectGpuName() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return '';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    if (!info) return '';
    const raw = gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || '';
    
    let clean = raw.replace(/ANGLE\s*\(/gi, '')
                   .replace(/Direct3D.*$/gi, '')
                   .replace(/OpenGL.*$/gi, '')
                   .replace(/NVIDIA Corporation|NVIDIA|AMD|Intel Inc\.|Intel\(R\)|Intel/gi, '')
                   .replace(/\(R\)|\(TM\)|[(),]/gi, ' ')
                   .replace(/\s+/g, ' ').trim();

    if (raw.includes('NVIDIA')) clean = 'NVIDIA ' + clean;
    else if (raw.includes('AMD') || raw.includes('Radeon')) clean = 'AMD ' + clean;
    else if (raw.includes('Intel')) clean = 'Intel ' + clean;
    return clean;
  } catch (e) {
    return '';
  }
}

function detectHardware() {
  return {
    gpu: detectGpuName(),
    threads: navigator.hardwareConcurrency || null,
    ram: navigator.deviceMemory || null
  };
}

/* ---------- 3. EVALUACIÓN Y PUNTAJE DE COMPONENTES ---------- */

function scoreGpu(text) {
  if (!text) return null;
  const options = text.toLowerCase().split(/\/| or |\|/);
  const scores = [];

  for (const option of options) {
    for (const [model, score] of GPU_DATABASE) {
      if (option.includes(model)) {
        const isMobile = option.includes('laptop') || option.includes('mobile') || option.includes('max-q');
        scores.push(isMobile ? Math.round(score * 0.82) : score);
        break;
      }
    }
  }

  if (scores.length) return Math.min(...scores);

  const t = text.toLowerCase();
  if (t.includes('rtx')) return 220;
  if (t.includes('gtx')) return 90;
  if (t.includes('radeon rx')) return 130;
  if (t.includes('iris') || t.includes('vega')) return 30;
  if (t.includes('uhd') || t.includes('hd graphics')) return 15;
  return null;
}

function scoreCpu(text) {
  if (!text) return null;
  const options = text.toLowerCase().split(/\/| or |\|/);
  const scores = [];

  for (const t of options) {
    const isX3D = t.includes('x3d');
    const x3dBonus = isX3D ? 1.35 : 1.0;

    const intel = t.match(/i([3579])[\s-]*(\d{4,5})([a-z]*)/);
    if (intel) {
      const digits = intel[2];
      const gen = digits.length === 5 ? Number(digits.slice(0, 2)) : Number(digits[0]);
      const tier = Number(intel[1]);
      const mobile = intel[3].includes('u') ? 0.65 : intel[3].includes('h') ? 0.88 : 1.0;
      const baseScore = INTEL_GEN_SCORES[gen] || (gen > 14 ? 175 : 60);
      scores.push(Math.round(baseScore * CPU_TIERS[tier] * mobile));
      continue;
    }

    const ryzen = t.match(/ryzen\s*([3579])\s*(\d)\d{3}([a-z]*)/);
    if (ryzen) {
      const gen = Number(ryzen[2]);
      const tier = Number(ryzen[1]);
      const mobile = ryzen[3].includes('u') ? 0.65 : ryzen[3].includes('h') ? 0.88 : 1.0;
      const baseScore = RYZEN_GEN_SCORES[gen] || (gen > 9 ? 180 : 80);
      scores.push(Math.round(baseScore * CPU_TIERS[tier] * mobile * x3dBonus));
      continue;
    }

    if (t.includes('xeon') || t.includes('fx-')) scores.push(50);
    else if (t.includes('core 2 quad') || t.includes('phenom')) scores.push(25);
    else if (t.includes('pentium') || t.includes('celeron') || t.includes('athlon')) scores.push(20);
  }

  return scores.length ? Math.min(...scores) : null;
}

/* ---------- 4. EXTRACCIÓN DE REQUISITOS (PARSER NLP) ---------- */

function cleanHtmlText(htmlStr) {
  if (!htmlStr) return '';
  return htmlStr.replace(/<br\s*\/?>/gi, '\n')
                .replace(/<[^>]+>/g, ' ')
                .replace(/&nbsp;/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
}

function parseRequirements(reqObj) {
  const minText = typeof reqObj === 'string' ? reqObj : (reqObj.minimum || '');
  const recText = typeof reqObj === 'string' ? '' : (reqObj.recommended || '');

  const extract = (text) => {
    if (!text) return { cpu: '', gpu: '', ram: null };
    const clean = cleanHtmlText(text);

    const cpuMatch = clean.match(/(?:Processor|Procesador|CPU)\s*:\s*([^:;.\n]+)/i);
    const gpuMatch = clean.match(/(?:Graphics|Gráficos|Video Card|Tarjeta de vídeo)\s*:\s*([^:;.\n]+)/i);
    const ramMatch = clean.match(/(?:Memory|Memoria|RAM)\s*:\s*(\d+)\s*(?:GB|MB)/i);

    let ramGb = null;
    if (ramMatch) {
      const val = Number(ramMatch[1]);
      ramGb = clean.includes('MB') && val > 256 ? Math.round(val / 1024) : val;
    }

    return {
      cpu: cpuMatch ? cpuMatch[1].trim() : clean,
      gpu: gpuMatch ? gpuMatch[1].trim() : clean,
      ram: ramGb
    };
  };

  return {
    minimum: extract(minText),
    recommended: extract(recText)
  };
}

/* ---------- 5. BÚSQUEDA Y AUTOCOMPLETADO DE JUEGOS ---------- */

let searchTimeout = null;

async function searchGamesSteam(query) {
  try {
    const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=spanish&cc=US`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    return (data.items || []).slice(0, 6).map(item => ({
      id: item.id,
      name: item.name,
      image: item.tiny_image,
      source: 'steam'
    }));
  } catch (e) {
    return BACKUP_GAMES.filter(g => g.name.toLowerCase().includes(query.toLowerCase())).map(g => ({
      id: g.id,
      name: g.name,
      image: g.image,
      source: 'local'
    }));
  }
}

async function fetchGameDetailsSteam(appId) {
  if (typeof appId === 'string' && appId.length < 10 && isNaN(appId)) {
    const local = BACKUP_GAMES.find(g => g.id === appId);
    if (local) return local;
  }

  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=spanish`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('API_FAIL');
  const data = await res.json();
  const gameData = data[appId] && data[appId].data;
  if (!gameData) throw new Error('NOT_FOUND');

  const reqs = gameData.pc_requirements || {};
  if (!reqs.minimum && !reqs.recommended) throw new Error('NO_REQS');

  return {
    name: gameData.name,
    image: gameData.header_image || gameData.capsule_image,
    minimum: reqs.minimum || '',
    recommended: reqs.recommended || ''
  };
}

async function fetchGameRAWG(name, key) {
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

  return {
    name: game.name,
    image: game.background_image,
    minimum: req.minimum || '',
    recommended: req.recommended || ''
  };
}

/* ---------- 6. MOTOR DE CÁLCULO DE FPS Y CUELLO DE BOTELLA ---------- */

function analyzePerformance(pc, gameData) {
  const reqs = parseRequirements(gameData);
  const min = reqs.minimum;
  const rec = reqs.recommended;

  const userGpuScore = scoreGpu(pc.gpu) || 100;
  const minGpuScore = scoreGpu(min.gpu) || 75;
  const recGpuScore = scoreGpu(rec.gpu) || Math.round(minGpuScore * 1.5);

  const userCpuScore = scoreCpu(pc.cpu) || 70;
  const minCpuScore = scoreCpu(min.cpu) || 50;
  const recCpuScore = scoreCpu(rec.cpu) || Math.round(minCpuScore * 1.5);

  const userRam = pc.ram || 8;
  const minRam = min.ram || 8;
  const recRam = rec.ram || 16;

  const gpuRatio = userGpuScore / recGpuScore;
  const cpuRatio = userCpuScore / recCpuScore;

  let gameWeight = 'medium';
  const reqGpuText = (min.gpu + ' ' + rec.gpu).toLowerCase();
  if (reqGpuText.includes('rtx 2060') || reqGpuText.includes('gtx 1070') || reqGpuText.includes('rx 5700') || recGpuScore >= 200) {
    gameWeight = 'heavy';
  } else if (reqGpuText.includes('gtx 660') || reqGpuText.includes('hd 4000') || minGpuScore <= 40) {
    gameWeight = 'light';
  }

  let baseFps1080High = 60 * gpuRatio;
  if (gameWeight === 'heavy') baseFps1080High *= 0.85;
  if (gameWeight === 'light') baseFps1080High *= 1.35;

  if (cpuRatio < 0.8) baseFps1080High *= Math.max(0.65, cpuRatio);
  if (userRam < minRam) baseFps1080High *= 0.7;

  const fps1080Low = Math.round(baseFps1080High * 1.35);
  const fps1080High = Math.round(baseFps1080High);
  const fps1440High = Math.round(baseFps1080High * 0.72);
  const fps4kHigh = Math.round(baseFps1080High * 0.42);

  // Análisis de Cuello de Botella Refinado
  let bottleneck = { type: 'none', percent: 0, text: '', badgeCls: 'ok' };
  const targetGpuFps = 60 * gpuRatio;
  const targetCpuFps = 60 * cpuRatio;

  if (targetCpuFps < targetGpuFps * 0.7 && targetCpuFps < 120) {
    const pct = Math.min(45, Math.round((1 - (targetCpuFps / targetGpuFps)) * 100));
    bottleneck = {
      type: 'cpu',
      percent: pct,
      badgeCls: pct > 25 ? 'bad' : 'warn',
      text: `⚠️ **Cuello de botella de CPU (${pct}%)**: Tu tarjeta de video es más potente que tu procesador. En resoluciones bajas (1080p), la CPU limitará los FPS máximos.`
    };
  } else if (targetGpuFps < targetCpuFps * 0.7 && targetGpuFps < 120) {
    const pct = Math.min(50, Math.round((1 - (targetGpuFps / targetCpuFps)) * 100));
    bottleneck = {
      type: 'gpu',
      percent: pct,
      badgeCls: pct > 30 ? 'bad' : 'warn',
      text: `⚠️ **Cuello de botella de GPU (${pct}%)**: Tu tarjeta de video alcanzará el 100% de uso antes que la CPU. Para subir FPS deberás reducir la resolución o sombras.`
    };
  } else {
    bottleneck = {
      type: 'balanced',
      percent: 0,
      badgeCls: 'ok',
      text: '✅ **Sistema Equilibrado**: Tu CPU y GPU trabajan en perfecta sintonía para este juego.'
    };
  }

  let status = 'ok';
  let statusText = '¡Corre Excelente!';
  if (fps1080High < 30 && fps1080Low < 40) {
    status = 'bad';
    statusText = 'No Recomendado (Rendimiento insuficiente)';
  } else if (fps1080High < 55) {
    status = 'min';
    statusText = 'Corre en Ajustes Medios / Bajos';
  }

  const tips = [];
  if (gpuRatio < 1.0) tips.push('Habilita tecnologías de reescalado como **NVIDIA DLSS** o **AMD FSR** en modo Calidad/Equilibrado.');
  if (bottleneck.type === 'gpu') tips.push('Reduce la calidad de las **sombras, sombras de contacto y oclusión ambiental** para ganar hasta un +20% de FPS.');
  if (bottleneck.type === 'cpu') tips.push('Baja la densidad de población, la distancia de visión y los detalles de física para liberar carga del procesador.');
  if (userRam < 16) tips.push('Considera ampliar a **16 GB de RAM** para evitar congelamientos (stuttering) en juegos modernos.');
  if (tips.length === 0) tips.push('Tu PC supera con creces lo recomendado. Puedes activar trazado de rayos (Ray Tracing) o jugar a mayores resoluciones.');

  return {
    fps: {
      l1080: fps1080Low,
      h1080: fps1080High,
      h1440: fps1440High,
      h4k: fps4kHigh
    },
    bottleneck,
    status,
    statusText,
    tips,
    details: {
      cpu: { user: pc.cpu, status: cpuRatio >= 1 ? 'ok' : cpuRatio >= 0.7 ? 'min' : 'bad', text: cpuRatio >= 1 ? 'Supera recomendado' : cpuRatio >= 0.7 ? 'Cumple el mínimo' : 'Por debajo del mínimo' },
      gpu: { user: pc.gpu, status: gpuRatio >= 1 ? 'ok' : gpuRatio >= 0.7 ? 'min' : 'bad', text: gpuRatio >= 1 ? 'Supera recomendado' : gpuRatio >= 0.7 ? 'Cumple el mínimo' : 'Por debajo del mínimo' },
      ram: { user: pc.ram + ' GB', status: userRam >= recRam ? 'ok' : userRam >= minRam ? 'min' : 'bad', text: userRam >= recRam ? 'Óptima' : userRam >= minRam ? 'Suficiente' : 'Insuficiente' }
    }
  };
}

/* ---------- 7. INTERFAZ DE USUARIO & RENDERING ---------- */

const $ = id => document.getElementById(id);

function safe(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

function renderResult(game, result) {
  const f = result.fps;
  const b = result.bottleneck;
  const d = result.details;

  $('result').innerHTML = `
    <div class="game-head">
      ${game.image ? `<img src="${safe(game.image)}" alt="${safe(game.name)}">` : ''}
      <div>
        <h2>${safe(game.name)}</h2>
        <span class="source">Datos verificados de Requisitos</span>
      </div>
    </div>

    <!-- Veredicto Principal -->
    <div class="verdict-banner st-${result.status}">
      <span>${result.status === 'ok' ? '🚀' : result.status === 'min' ? '⚠️' : '❌'} ${result.statusText}</span>
      <span>~${f.h1080} FPS (1080p High)</span>
    </div>

    <!-- Matriz de Estimación de FPS -->
    <div class="fps-section-title">📊 FPS Estimados por Resolución & Ajuste</div>
    <div class="fps-grid">
      <div class="fps-card st-${f.l1080 >= 60 ? 'ok' : f.l1080 >= 35 ? 'min' : 'bad'}">
        <div class="fps-resolution">1080p Low</div>
        <div class="fps-value">${f.l1080}</div>
        <div class="fps-label-sub">FPS Medios</div>
      </div>
      <div class="fps-card highlight st-${f.h1080 >= 60 ? 'ok' : f.h1080 >= 35 ? 'min' : 'bad'}">
        <div class="fps-resolution">1080p High</div>
        <div class="fps-value">${f.h1080}</div>
        <div class="fps-label-sub">Recomendado</div>
      </div>
      <div class="fps-card st-${f.h1440 >= 60 ? 'ok' : f.h1440 >= 35 ? 'min' : 'bad'}">
        <div class="fps-resolution">1440p High</div>
        <div class="fps-value">${f.h1440}</div>
        <div class="fps-label-sub">QHD</div>
      </div>
      <div class="fps-card st-${f.h4k >= 60 ? 'ok' : f.h4k >= 35 ? 'min' : 'bad'}">
        <div class="fps-resolution">4K Ultra</div>
        <div class="fps-value">${f.h4k}</div>
        <div class="fps-label-sub">UHD</div>
      </div>
    </div>

    <!-- Cuello de Botella -->
    <div class="bottleneck-card">
      <div class="bottleneck-header">
        <div class="bottleneck-title">⚖️ Equilibrio del Sistema</div>
        <span class="bottleneck-badge ${b.badgeCls}">
          ${b.percent > 0 ? `${b.percent}% Cuello de Botella` : 'Sin Cuello de Botella'}
        </span>
      </div>
      <div class="bottleneck-bar-container">
        <div class="bottleneck-fill ${b.badgeCls}" style="width: ${Math.max(10, b.percent)}%"></div>
      </div>
      <p class="bottleneck-desc">${b.text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}</p>
    </div>

    <!-- Desglose por Componente -->
    <div class="rows">
      <div class="row">
        <span class="icon">${d.gpu.status === 'ok' ? '✅' : d.gpu.status === 'min' ? '⚠️' : '❌'}</span>
        <div>
          <h3>GPU · <span class="st-${d.gpu.status}">${d.gpu.text}</span></h3>
          <p>Tu equipo: ${safe(d.gpu.user)}</p>
        </div>
      </div>

      <div class="row">
        <span class="icon">${d.cpu.status === 'ok' ? '✅' : d.cpu.status === 'min' ? '⚠️' : '❌'}</span>
        <div>
          <h3>CPU · <span class="st-${d.cpu.status}">${d.cpu.text}</span></h3>
          <p>Tu equipo: ${safe(d.cpu.user)}</p>
        </div>
      </div>

      <div class="row">
        <span class="icon">${d.ram.status === 'ok' ? '✅' : d.ram.status === 'min' ? '⚠️' : '❌'}</span>
        <div>
          <h3>RAM · <span class="st-${d.ram.status}">${d.ram.text}</span></h3>
          <p>Tu equipo: ${safe(d.ram.user)}</p>
        </div>
      </div>
    </div>

    <!-- Consejos de Optimización -->
    <div class="tips-card">
      <h4>💡 Consejos de Optimización Gráfica</h4>
      <ul class="tips-list">
        ${result.tips.map(tip => `<li>${tip.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}</li>`).join('')}
      </ul>
    </div>
  `;
}

function renderError(msg) {
  $('result').innerHTML = `<p class="msg">❌ ${safe(msg)}</p>`;
}

/* ---------- 8. EVENTOS Y AUTOCOMPLETADO ---------- */

function setupAutocomplete() {
  const gameInput = $('game');
  const dropdown = $('autocomplete-list');

  gameInput.addEventListener('input', () => {
    const query = gameInput.value.trim();
    clearTimeout(searchTimeout);

    if (query.length < 2) {
      dropdown.classList.add('hidden');
      return;
    }

    searchTimeout = setTimeout(async () => {
      const results = await searchGamesSteam(query);
      if (results.length === 0) {
        dropdown.innerHTML = '<div class="autocomplete-item"><span class="item-title">No se encontraron juegos</span></div>';
      } else {
        dropdown.innerHTML = results.map(item => `
          <div class="autocomplete-item" data-id="${item.id}" data-name="${safe(item.name)}">
            ${item.image ? `<img src="${item.image}" alt="">` : ''}
            <div class="item-info">
              <span class="item-title">${safe(item.name)}</span>
              <span class="item-sub">Juego de PC</span>
            </div>
          </div>
        `).join('');
      }
      dropdown.classList.remove('hidden');
    }, 250);
  });

  dropdown.addEventListener('click', e => {
    const item = e.target.closest('.autocomplete-item');
    if (!item) return;
    const name = item.getAttribute('data-name');
    const id = item.getAttribute('data-id');

    if (name) {
      gameInput.value = name;
      gameInput.setAttribute('data-selected-id', id || '');
      dropdown.classList.add('hidden');
    }
  });

  document.addEventListener('click', e => {
    if (!gameInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
}

function fillHardwareForm() {
  const hw = detectHardware();
  if (hw.gpu) $('gpu').value = hw.gpu;
  if (hw.ram) $('ram').value = hw.ram;

  const statusText = [
    'GPU detectada: ' + (hw.gpu || 'No disponible'),
    'Hilos CPU: ' + (hw.threads || 'No disponible'),
    'RAM: ' + (hw.ram ? hw.ram + ' GB' : 'No reportada')
  ].join(' · ');

  $('detected').textContent = 'Detectado automáticamente: ' + statusText;
}

// Manejo del formulario de Análisis
$('form').addEventListener('submit', async event => {
  event.preventDefault();

  const pc = {
    gpu: $('gpu').value.trim(),
    cpu: $('cpu').value.trim(),
    ram: Number($('ram').value) || 8
  };
  const gameName = $('game').value.trim();
  const selectedId = $('game').getAttribute('data-selected-id');
  const source = $('api-source').value;
  const rawgKey = $('apikey').value.trim();

  if (!pc.gpu || !pc.cpu || !gameName) {
    return renderError('Por favor completa los campos de GPU, CPU y Nombre del Juego.');
  }

  if (source === 'rawg' && !rawgKey) {
    return renderError('Por favor ingresa tu clave gratuita de RAWG o cambia la fuente a Steam Store API.');
  }

  $('go').disabled = true;
  $('go').textContent = '⏳ Analizando hardware y calculando FPS…';

  try {
    let gameData = null;
    if (source === 'steam') {
      gameData = await fetchGameDetailsSteam(selectedId || gameName);
    } else {
      gameData = await fetchGameRAWG(gameName, rawgKey);
      try { localStorage.setItem('gsa_rawg_key', rawgKey); } catch (e) {}
    }

    const performanceResult = analyzePerformance(pc, gameData);
    renderResult(gameData, performanceResult);
  } catch (err) {
    const errMsgs = {
      NOT_FOUND: 'No se encontró el juego especificado. Intenta seleccionarlo desde el autocompletado.',
      NO_REQS: 'Este juego no especifica requisitos técnicos oficiales de PC.',
      API_FAIL: 'No se pudo conectar con el servicio de Requisitos. Revisa tu conexión a internet.'
    };
    renderError(errMsgs[err.message] || 'Ocurrió un error al obtener los requisitos del juego.');
  } finally {
    $('go').disabled = false;
    $('go').textContent = '⚡ Analizar mi PC y calcular FPS';
  }
});

// Selector de fuente de API
$('api-source').addEventListener('change', () => {
  if ($('api-source').value === 'rawg') {
    $('rawg-key-container').classList.remove('hidden');
  } else {
    $('rawg-key-container').classList.add('hidden');
  }
});

$('redetect').addEventListener('click', fillHardwareForm);

// Inicialización al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  fillHardwareForm();
  setupAutocomplete();
  try {
    const savedKey = localStorage.getItem('gsa_rawg_key');
    if (savedKey) $('apikey').value = savedKey;
  } catch (e) {}
});