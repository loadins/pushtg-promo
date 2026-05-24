/* ═════════════════════════════════════════════════════════════════════
   PUSHTG — promo / app.js
   Scroll, observers, counters, HUD, cursor, narration, mode toggle.
   ═════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasHover = window.matchMedia('(hover:hover)').matches;
  const $  = (s, ctx = document) => ctx.querySelector(s);
  const $$ = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // ───────────────────────────────────────────────────────────────────
  // SMOOTH SCROLL (Lenis-style — wheel-driven RAF lerp, native scroll fallback)
  // ───────────────────────────────────────────────────────────────────
  function setupSmoothScroll() {
    if (RM) return;
    // detect touch — let native momentum handle mobile
    if ('ontouchstart' in window && innerWidth < 900) return;

    let target = window.scrollY;
    let current = window.scrollY;
    const ease = 0.085;

    document.documentElement.style.scrollBehavior = 'auto';

    window.addEventListener('wheel', (e) => {
      // skip if interacting with a scrollable element (textareas etc)
      if (e.target.closest('textarea, [data-no-smooth]')) return;
      e.preventDefault();
      target = clamp(target + e.deltaY, 0, document.documentElement.scrollHeight - innerHeight);
    }, { passive: false });

    // keyboard
    window.addEventListener('keydown', (e) => {
      const k = e.key;
      const vh = innerHeight;
      if (k === 'PageDown' || k === ' ')         target += vh * 0.9;
      else if (k === 'PageUp')                   target -= vh * 0.9;
      else if (k === 'Home')                     target  = 0;
      else if (k === 'End')                      target  = document.documentElement.scrollHeight;
      else if (k === 'ArrowDown')                target += 120;
      else if (k === 'ArrowUp')                  target -= 120;
      else return;
      target = clamp(target, 0, document.documentElement.scrollHeight - innerHeight);
    });

    (function loop() {
      requestAnimationFrame(loop);
      current = lerp(current, target, ease);
      if (Math.abs(current - target) < 0.5) current = target;
      window.scrollTo(0, current);
    })();
  }

  // ───────────────────────────────────────────────────────────────────
  // LOADER
  // ───────────────────────────────────────────────────────────────────
  const loader = $('#loader');
  const loaderFill = $('#loaderFill');
  const loaderStatus = $('#loaderStatus');

  function bootLoader() {
    const messages = [
      'инициализация сцены',
      'загрузка геометрии',
      'привязка контекста',
      'готово',
    ];
    let pct = 0;
    const start = performance.now();
    const dur = 1400;

    function step(now) {
      const t = clamp((now - start) / dur, 0, 1);
      pct = Math.floor(t * 100);
      loaderFill.style.width = pct + '%';
      const msgIdx = Math.min(messages.length - 1, Math.floor(t * messages.length));
      loaderStatus.textContent = messages[msgIdx];
      if (t < 1) requestAnimationFrame(step);
      else finishLoader();
    }
    requestAnimationFrame(step);
  }

  function finishLoader() {
    loader.classList.add('is-done');
    document.body.classList.add('is-loaded');
    // reveal HUD + narration
    $$('.hud, .narration').forEach((el) => el.classList.add('is-ready'));
    // kick off first reveals on intro section
    revealCheck();
  }

  // ───────────────────────────────────────────────────────────────────
  // CURSOR + TRAIL
  // ───────────────────────────────────────────────────────────────────
  const cursor = $('#cursor');
  const trail = $('#cursorTrail');

  function setupCursor() {
    if (!hasHover || RM) return;
    let x = innerWidth / 2, y = innerHeight / 2;
    let cx = x, cy = y;

    window.addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; });

    (function loop() {
      cx += (x - cx) * 0.25;
      cy += (y - cy) * 0.25;
      cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      requestAnimationFrame(loop);
    })();

    const hoverables = 'a, button, .btn, .pair, .number, .mode-btn';
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(hoverables)) cursor.classList.add('is-hover');
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(hoverables)) cursor.classList.remove('is-hover');
    });

    // particle trail on canvas
    const ctx = trail.getContext('2d');
    const dots = [];
    function sizeCanvas() {
      trail.width = innerWidth * devicePixelRatio;
      trail.height = innerHeight * devicePixelRatio;
      trail.style.width = innerWidth + 'px';
      trail.style.height = innerHeight + 'px';
      ctx.scale(devicePixelRatio, devicePixelRatio);
    }
    sizeCanvas();
    window.addEventListener('resize', () => {
      trail.width = trail.width;
      sizeCanvas();
    });

    window.addEventListener('mousemove', (e) => {
      for (let i = 0; i < 2; i++) {
        dots.push({
          x: e.clientX + (Math.random() - 0.5) * 6,
          y: e.clientY + (Math.random() - 0.5) * 6,
          life: 1,
          r: Math.random() * 1.2 + 0.4,
        });
      }
      if (dots.length > 220) dots.splice(0, dots.length - 220);
    });

    (function paint() {
      requestAnimationFrame(paint);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (let i = dots.length - 1; i >= 0; i--) {
        const d = dots[i];
        d.life -= 0.02;
        if (d.life <= 0) { dots.splice(i, 1); continue; }
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
        ctx.fillStyle = hexToRgba(accent || '#4F7AFF', d.life * 0.7);
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r * d.life, 0, Math.PI * 2);
        ctx.fill();
      }
    })();
  }

  function hexToRgba(hex, a) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const r = parseInt(hex.slice(0, 2), 16) || 79;
    const g = parseInt(hex.slice(2, 4), 16) || 122;
    const b = parseInt(hex.slice(4, 6), 16) || 255;
    return `rgba(${r},${g},${b},${a})`;
  }

  // ───────────────────────────────────────────────────────────────────
  // REVEAL OBSERVER
  // ───────────────────────────────────────────────────────────────────
  function revealCheck() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    $$('.reveal, .reveal-mask, .reveal-card').forEach((el) => io.observe(el));
  }

  // ───────────────────────────────────────────────────────────────────
  // SCROLL DRIVER — sections, telemetry, scene, narration, pain steps
  // ───────────────────────────────────────────────────────────────────
  const scenes = $$('.scene');
  const siNum = $('#siNum');
  const telScene = $('#telScene');
  const telLoad = $('#telLoad');
  const narrationText = $('#narrationText');

  const NARRATION = {
    intro:    'прокрути вниз — начнём',
    pain:     'знакомая ситуация?',
    shift:    'смена подхода →',
    solution: 'вот что построили',
    numbers:  'цифры с боевых проектов',
    cta:      'остался один шаг',
  };

  const SCENE_LABELS = {
    intro: 'intro', pain: 'pain · 01', shift: 'shift · 02',
    solution: 'solution · 03', numbers: 'numbers · 04', cta: 'cta · 05',
  };

  let activeScene = null;
  function setActiveScene(name) {
    if (activeScene === name) return;
    activeScene = name;
    const num = $(`[data-scene="${name}"]`)?.dataset.num || '00';
    siNum.textContent = num;
    telScene.textContent = SCENE_LABELS[name] || name;
    fadeNarration(NARRATION[name] || '');
    window.PromoScene?.setScene(name);

    // auto-switch mode: pain on pain scene, solution everywhere else
    setMode(name === 'pain' ? 'pain' : 'solution', false);
  }

  function fadeNarration(txt) {
    narrationText.classList.add('is-fading');
    setTimeout(() => {
      narrationText.textContent = txt;
      narrationText.classList.remove('is-fading');
    }, 220);
  }

  // pain pinned step driver
  const painSection = $('.scene--pain');
  const painSteps = [
    {
      title: 'Ручной охват',
      body:  'Менеджер вручную ищет группы, копирует юзернеймы, пишет каждому. Часы рутины в день до первого сообщения.',
      stats: [['~4 ч', 'рутины в день'], ['~50', 'лидов в день']],
      code:  'err.manual',
    },
    {
      title: 'Языковой барьер',
      body:  'Шаблон на русском уходит в Индию, Пакистан, Бангладеш. Ответов нет — менеджер не говорит на языке лида.',
      stats: [['~2%', 'response rate'], ['0', 'диалогов на хинди']],
      code:  'err.language',
    },
    {
      title: 'Молчание лида',
      body:  'Лид прочитал и ушёл. Менеджер забыл вернуться. Через неделю контакт потерян навсегда.',
      stats: [['до 80%', 'лидов теряется'], ['0', 'follow-up']],
      code:  'err.followup',
    },
    {
      title: 'Бан аккаунта',
      body:  '50 сообщений с одного IP — Telegram даёт rest. После двух рестов — постоянный бан.',
      stats: [['~50', 'сообщений до rest'], ['1 IP', 'под риском']],
      code:  'err.banned',
    },
    {
      title: 'Нет аналитики',
      body:  'Не видно, где лид застрял. Что работает — непонятно. Рост невозможен.',
      stats: [['0', 'видимости'], ['—', 'A/B-тестов']],
      code:  'err.blindspot',
    },
  ];

  const painTitle = $('#painTitle');
  const painBody  = $('#painBody');
  const painStats = $('#painStats');
  const painStepNum = $('#painStepNum');
  const painProgress = $('#painProgress');
  const painMarkerCode = $('#painMarkerCode');

  let lastPainStep = -1;
  function updatePainPin() {
    if (!painSection) return;
    const rect = painSection.getBoundingClientRect();
    const total = painSection.offsetHeight - innerHeight;
    if (total <= 0) return;
    const scrolled = clamp(-rect.top, 0, total);
    const progress = scrolled / total;

    painProgress.style.width = (progress * 100).toFixed(1) + '%';

    const stepIdx = clamp(Math.floor(progress * painSteps.length), 0, painSteps.length - 1);
    if (stepIdx !== lastPainStep) {
      lastPainStep = stepIdx;
      const s = painSteps[stepIdx];
      // small fade-in trick: dim then swap then restore
      [painTitle, painBody, painStats].forEach((el) => { el.style.opacity = '0'; });
      setTimeout(() => {
        painTitle.textContent = s.title;
        painBody.textContent = s.body;
        painStats.innerHTML = s.stats.map(
          ([v, l]) => `<div class="ps-item"><span class="ps-val">${v}</span><span class="ps-lbl">${l}</span></div>`
        ).join('');
        painStepNum.textContent = stepIdx + 1;
        painMarkerCode.textContent = s.code;
        [painTitle, painBody, painStats].forEach((el) => { el.style.opacity = ''; });
      }, 220);
    }
  }

  // overall scroll progress + active scene detection
  function updateScrollState() {
    const docH = document.documentElement.scrollHeight - innerHeight;
    const scrollY = window.scrollY;
    const progress = docH > 0 ? scrollY / docH : 0;

    window.PromoScene?.setScroll(progress, scrollY);
    telLoad.textContent = (progress * 100).toFixed(0) + '%';

    // active scene = the one whose center is closest to viewport center
    const vc = scrollY + innerHeight / 2;
    let best = scenes[0], bestDist = Infinity;
    for (const s of scenes) {
      const top = s.offsetTop;
      const center = top + s.offsetHeight / 2;
      const dist = Math.abs(center - vc);
      if (dist < bestDist) { bestDist = dist; best = s; }
    }
    if (best) setActiveScene(best.dataset.scene);

    updatePainPin();
  }

  let ticking = false;
  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => { updateScrollState(); ticking = false; });
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  // ───────────────────────────────────────────────────────────────────
  // MODE TOGGLE
  // ───────────────────────────────────────────────────────────────────
  function setMode(mode, fromUser = false) {
    document.body.classList.toggle('mode-pain', mode === 'pain');
    document.body.classList.toggle('mode-solution', mode === 'solution');
    $$('.mode-btn').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.mode === mode);
    });
    window.PromoScene?.setMode(mode);
    if (fromUser) {
      // user-driven toggle keeps until next scene change
      currentMode = mode;
    }
  }
  let currentMode = 'solution';
  $$('.mode-btn').forEach((b) => {
    b.addEventListener('click', () => setMode(b.dataset.mode, true));
  });

  // ───────────────────────────────────────────────────────────────────
  // NUMBER COUNTERS
  // ───────────────────────────────────────────────────────────────────
  function animateCounter(el) {
    const target = parseFloat(el.dataset.count);
    if (isNaN(target)) return;
    const suffix = el.dataset.suffix || '';
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const dur = 1600;
    const start = performance.now();
    function step(now) {
      const t = clamp((now - start) / dur, 0, 1);
      // ease out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const v = target * eased;
      el.textContent = v.toFixed(decimals) + suffix;
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = target.toFixed(decimals) + suffix;
    }
    requestAnimationFrame(step);
  }

  const countObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        animateCounter(e.target);
        countObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.4 });
  $$('.n-val[data-count]').forEach((el) => countObserver.observe(el));

  // ───────────────────────────────────────────────────────────────────
  // MAGNETIC HOVER — buttons subtly pull toward cursor on proximity
  // ───────────────────────────────────────────────────────────────────
  function setupMagnetic() {
    if (!hasHover || RM) return;
    const items = $$('.btn, .mode-btn, .pair, .number');
    items.forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - r.left - r.width / 2) * 0.15;
        const dy = (e.clientY - r.top - r.height / 2) * 0.15;
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
      });
    });
  }

  // ───────────────────────────────────────────────────────────────────
  // BOOT
  // ───────────────────────────────────────────────────────────────────
  setupSmoothScroll();
  setupCursor();
  setupMagnetic();
  bootLoader();
  // run scroll handler once we have content
  setTimeout(updateScrollState, 50);
})();
