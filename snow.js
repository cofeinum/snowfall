(function() {
  // Настройки эффекта
  const CONFIG = {
    desktopCount: 500,          // Количество снежинок на ПК
    mobileCount: 240,           // Количество снежинок на мобильных
    color: '220, 220, 220',     // Основной цвет снежинок
    shadowColor: '64, 70, 77',  // RGB-цвет теней
    shadowOpacity: 0.08,        // Базовая прозрачность теней
    shadowBlur: 2.2,            // Множитель размытия и рассеивания полутени
    opacity: 0.65,              // Общая прозрачность снежинок
    soften: 1.6,                // Общее размытие ВСЕХ снежинок (0 - чёткие, 1.2 - мягкие, 3.0+ - сильный блюр)
    depthBlur: 1.0,             // Дополнительное размытие от глубины резкости (0 - отключить, 1.0 - стандарт)
    fadeInDuration: 3.0,        // Время плавного появления снегопада при старте (в секундах)
    flakeFadeTime: 1.5,         // Время плавного появления/исчезания отдельной снежинки (в сек.)
    edgeFadeZone: 18,           // Зона плавного затухания у верхнего и нижнего края экрана (в пикселях)
    zIndex: 9999,               // Слой поверх контента
    minDepth: 4.8,              // Минимальная глубина (ближний план)
    maxDepth: 36.0,             // Максимальная глубина (дальний план)
    focusDepth: 8.0,            // Фокусное расстояние (где снежинки наиболее чёткие)
    baseSize: 3.8,              // Базовый размер снежинки
    irregularity: 0.35,         // Степень неровности формы (0 - круг, 0.5 - рваные хлопья)
    stretch: 0.3,               // Степень вытягивания/сжатия при вращении
    spinSpeed: 1.8,             // Скорость вращения
    fallSpeed: 2.2,             // Скорость падения
    windStrength: 0.8,          // Сила ветра
    windGustiness: 0.95,        // Порывистость ветра
    cursorRadius: 125,          // Радиус реакции на курсор (в пикселях)
    cursorStrength: 48,         // Сила отталкивания курсором
    respectReducedMotion: true, // Учитывать настройки снижения анимации в ОС
    canvasClassName: "snowFall" // CSS-класс для <canvas>
  };

  if (
    CONFIG.respectReducedMotion &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.className = CONFIG.canvasClassName;
  Object.assign(canvas.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: String(CONFIG.zIndex)
  });
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  let width = 0;
  let height = 0;
  let dpr = 1;
  let flakes = [];
  let pointer = {
    x: -9999,
    y: -9999,
    vx: 0,
    vy: 0,
    lastX: -9999,
    lastY: -9999,
    moved: false
  };
  let animationId = null;
  let lastTime = performance.now();
  let totalTime = 0;

  const rand = (min, max) => min + Math.random() * (max - min);

  function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  function generateShapePoints(seed, irregularity) {
    const segments = 14;
    const points = [];
    const phase = seed * 43.0;

    for (let i = 0; i < segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const wobble =
        0.5 * Math.sin(3.0 * theta + phase) +
        0.3 * Math.sin(5.0 * theta + phase * 1.7) +
        0.2 * Math.sin(7.0 * theta + phase * 2.3);

      const radiusFactor = 1.0 - irregularity * (0.5 + 0.5 * wobble);
      points.push({
        cos: Math.cos(theta) * radiusFactor,
        sin: Math.sin(theta) * radiusFactor
      });
    }
    return points;
  }

  function createFlake(isInitial = true) {
    const t = Math.pow(Math.random(), 1.6);
    const depth = CONFIG.minDepth + t * (CONFIG.maxDepth - CONFIG.minDepth);
    const scale = CONFIG.focusDepth / depth;

    const opticalBlur = Math.abs(1 / CONFIG.focusDepth - 1 / depth) * 18 * CONFIG.depthBlur;
    const totalBlur = Math.max(0, CONFIG.soften + opticalBlur);
    const clampedBlur = Math.min(totalBlur, 10);

    const isNear = depth < CONFIG.focusDepth * 0.5;
    const seed = Math.random();

    const blurRatio = Math.min(1, clampedBlur / 7);
    const effectiveIrregularity = CONFIG.irregularity * (1 - 0.55 * blurRatio);
    const speedY = CONFIG.fallSpeed * scale * rand(0.8, 1.3);

    const travelDistance = height + 80;
    const estimatedDuration = travelDistance / (speedY * 60);
    const maxLife = Math.max(CONFIG.flakeFadeTime * 2.2, estimatedDuration * rand(0.75, 1.05));

    return {
      x: rand(-50, width + 50),
      y: isInitial ? rand(0, height) : rand(-40, 20),
      vx: 0,
      vy: 0,
      depth: depth,
      seed: seed,
      size: Math.max(1.4, CONFIG.baseSize * scale * rand(0.7, 1.3)),
      speedY: speedY,
      swayAmp: rand(0.3, 1.2) * scale,
      swaySpeed: rand(0.8, 2.0),
      phase: rand(0, Math.PI * 2),
      angle: seed * Math.PI * 2,
      spin: CONFIG.spinSpeed * rand(-1, 1),
      stretchFactor: rand(0.2, 1.0),
      shapePoints: generateShapePoints(seed, effectiveIrregularity),
      blur: clampedBlur,
      baseAlpha: CONFIG.opacity * (isNear ? rand(0.35, 0.65) : rand(0.5, 1.0)),
      hasShadow: depth < CONFIG.focusDepth * 0.9 && Math.random() > 0.45,
      age: isInitial ? rand(CONFIG.flakeFadeTime, maxLife * 0.7) : 0,
      maxLife: maxLife
    };
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const isMobile = width <= 767;
    const targetCount = isMobile ? CONFIG.mobileCount : CONFIG.desktopCount;

    if (flakes.length === 0) {
      for (let i = 0; i < targetCount; i++) {
        flakes.push(createFlake(true));
      }
    } else if (flakes.length < targetCount) {
      while (flakes.length < targetCount) {
        flakes.push(createFlake(false));
      }
    } else if (flakes.length > targetCount) {
      flakes.length = targetCount;
    }
  }

  window.addEventListener('pointermove', (e) => {
    if (pointer.lastX !== -9999) {
      const dx = e.clientX - pointer.lastX;
      const dy = e.clientY - pointer.lastY;
      if (dx !== 0 || dy !== 0) {
        pointer.vx = dx * 0.25;
        pointer.vy = dy * 0.25;
        pointer.moved = true;
      }
    }
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.lastX = e.clientX;
    pointer.lastY = e.clientY;
  }, {
    passive: true
  });

  window.addEventListener('pointerleave', () => {
    pointer.x = -9999;
    pointer.y = -9999;
    pointer.lastX = -9999;
    pointer.lastY = -9999;
    pointer.vx = 0;
    pointer.vy = 0;
    pointer.moved = false;
  }, {
    passive: true
  });

  window.addEventListener('resize', resize);

  function traceFlakePath(points, radius) {
    const len = points.length;
    ctx.beginPath();
    for (let i = 0; i < len; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % len];
      const midX = ((p1.cos + p2.cos) * 0.5) * radius;
      const midY = ((p1.sin + p2.sin) * 0.5) * radius;

      if (i === 0) {
        const pLast = points[len - 1];
        ctx.moveTo(((pLast.cos + p1.cos) * 0.5) * radius, ((pLast.sin + p1.sin) * 0.5) * radius);
      }
      ctx.quadraticCurveTo(p1.cos * radius, p1.sin * radius, midX, midY);
    }
    ctx.closePath();
  }

  function drawFlake(f, effectiveAlpha) {
    if (effectiveAlpha <= 0.002) return;

    const radius = f.size + f.blur * 0.75;
    const currentAngle = f.angle + totalTime * f.spin;
    const dynamicAspect =
      1.0 +
      CONFIG.stretch *
      f.stretchFactor *
      Math.abs(Math.sin(totalTime * f.spin * 0.7 + f.seed * 11.0));

    if (f.hasShadow) {
      const distanceFactor = Math.max(0.2, (CONFIG.focusDepth - f.depth) / CONFIG.focusDepth);
      const shadowRadius = radius * CONFIG.shadowBlur * (1 + distanceFactor * 0.9);
      const shadowAlpha = effectiveAlpha * CONFIG.shadowOpacity * (1 - distanceFactor * 0.45);
      const offsetX = 5 + distanceFactor * 8;
      const offsetY = 6 + distanceFactor * 10;

      ctx.save();
      ctx.translate(f.x + offsetX, f.y + offsetY);
      ctx.rotate(currentAngle);
      ctx.scale(dynamicAspect * 0.9, (1 / Math.sqrt(dynamicAspect)) * 0.9);

      const shadowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, shadowRadius);
      shadowGrad.addColorStop(0, `rgba(${CONFIG.shadowColor}, ${shadowAlpha})`);
      shadowGrad.addColorStop(0.35, `rgba(${CONFIG.shadowColor}, ${shadowAlpha * 0.55})`);
      shadowGrad.addColorStop(0.7, `rgba(${CONFIG.shadowColor}, ${shadowAlpha * 0.15})`);
      shadowGrad.addColorStop(1, `rgba(${CONFIG.shadowColor}, 0)`);

      ctx.beginPath();
      ctx.arc(0, 0, shadowRadius, 0, Math.PI * 2);
      ctx.fillStyle = shadowGrad;
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(currentAngle);
    ctx.scale(dynamicAspect, 1 / Math.sqrt(dynamicAspect));

    const coreRatio = f.size / radius;
    const renderAlpha = effectiveAlpha * (0.45 + 0.55 * coreRatio);

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    const midStop = Math.min(0.85, coreRatio * 0.75 + 0.15);

    grad.addColorStop(0, `rgba(${CONFIG.color}, ${renderAlpha})`);
    grad.addColorStop(midStop, `rgba(${CONFIG.color}, ${renderAlpha * 0.55})`);
    grad.addColorStop(1, `rgba(${CONFIG.color}, 0)`);

    traceFlakePath(f.shapePoints, radius);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  function render(now) {
    animationId = requestAnimationFrame(render);

    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    totalTime += dt;

    const globalFade = smoothstep(0, CONFIG.fadeInDuration, totalTime);

    const gust =
      Math.sin(totalTime * 0.31) * 0.6 +
      Math.sin(totalTime * 0.83 + 1.7) * 0.4;
    const currentWind = CONFIG.windStrength * (1 + CONFIG.windGustiness * gust);

    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < flakes.length; i++) {
      const f = flakes[i];
      f.age += dt;
      if (f.age >= f.maxLife || f.y > height + 40) {
        Object.assign(f, createFlake(false));
      }
      const sway = Math.sin(totalTime * f.swaySpeed + f.phase) * f.swayAmp;
      // Реакция на курсор срабатывает ТОЛЬКО в момент его перемещения
      if (pointer.moved) {
        const dx = f.x - pointer.x;
        const dy = f.y - pointer.y;
        const distSq = dx * dx + dy * dy;
        const maxR = CONFIG.cursorRadius;
        if (distSq < maxR * maxR && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const force = Math.exp(-distSq / (maxR * maxR * 0.5));
          const nearness = Math.min(2.0, Math.max(0.4, CONFIG.focusDepth / f.depth));
          f.vx += ((dx / dist) * CONFIG.cursorStrength * 0.05 + pointer.vx * 0.15) * force * nearness;
          f.vy += ((dy / dist) * CONFIG.cursorStrength * 0.05 + pointer.vy * 0.15) * force * nearness;
        }
      }
      f.x += (currentWind * (CONFIG.focusDepth / f.depth) + sway + f.vx) * (dt * 60);
      f.y += (f.speedY + f.vy) * (dt * 60);
      f.vx *= 0.92;
      f.vy *= 0.92;
      if (f.x > width + 40) {
        f.x = -30;
      } else if (f.x < -40) {
        f.x = width + 30;
      }
      const fadeIn = smoothstep(0, CONFIG.flakeFadeTime, f.age);
      const fadeOut = 1.0 - smoothstep(f.maxLife - CONFIG.flakeFadeTime, f.maxLife, f.age);
      const lifeFade = fadeIn * fadeOut;
      const topFade = smoothstep(-30, CONFIG.edgeFadeZone, f.y);
      const bottomFade = 1.0 - smoothstep(height - CONFIG.edgeFadeZone, height + 20, f.y);
      const edgeFade = topFade * bottomFade;
      const effectiveAlpha = f.baseAlpha * globalFade * lifeFade * edgeFade;
      drawFlake(f, effectiveAlpha);
    }
    // Сбрасываем флаг движения в конце кадра: если мышь не сдвинется до следующего кадра, реакции не будет
    pointer.moved = false;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animationId);
    } else {
      lastTime = performance.now();
      animationId = requestAnimationFrame(render);
    }
  });
  resize();
  animationId = requestAnimationFrame(render);
})();
