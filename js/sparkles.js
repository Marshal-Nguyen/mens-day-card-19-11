/**
 * Ambient sparkles, floating mini hearts, gentle Christmas snowfall,
 * and interactive baby-blue / silver / champagne fireworks engine.
 */
(function (global) {
  'use strict';

  const canvas = document.getElementById('sparkle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  let snowEnabled = true;
  let autoFireworksEnabled = false;
  let lastAutoFwTime = 0;

  const ambientParticles = [];
  const snowParticles = [];
  const burstParticles = [];
  const rockets = [];
  const fireworkSparks = [];

  const AMBIENT_COUNT = 44;
  const SNOW_COUNT = 46;

  const FW_PALETTES = [
    ['#89C4EE', '#CFE7F7', '#FFFFFF', '#B7DDF8'],
    ['#FFFFFF', '#DCE8F5', '#9ACDF2', '#FFE8B0'],
    ['#78BBE8', '#FFF2CC', '#FFFFFF', '#F6C6D8'],
    ['#A7D6F5', '#E8F4FD', '#D4DFEC', '#FFF7DB'],
  ];

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function createAmbient(randomY) {
    const isHeart = Math.random() < 0.25;
    return {
      x: rand(0, width),
      y: randomY ? rand(0, height) : height + rand(10, 80),
      vx: rand(-0.18, 0.18),
      vy: rand(-0.4, -0.14),
      size: isHeart ? rand(5, 9) : rand(1.5, 3.6),
      alpha: rand(0.28, 0.85),
      phase: rand(0, Math.PI * 2),
      twinkleSpeed: rand(0.015, 0.045),
      kind: isHeart ? 'heart' : Math.random() < 0.55 ? 'star' : 'orb',
      hue: Math.random() < 0.5 ? 'silver' : 'blue',
    };
  }

  function createSnow(randomY) {
    const isCrystal = Math.random() < 0.34;
    return {
      x: rand(0, width),
      y: randomY ? rand(0, height) : rand(-60, -10),
      vy: rand(0.45, 1.25),
      vx: rand(-0.25, 0.25),
      swayAmp: rand(0.2, 0.65),
      swayPhase: rand(0, Math.PI * 2),
      swaySpeed: rand(0.01, 0.028),
      rot: rand(0, Math.PI * 2),
      rotSpeed: rand(-0.015, 0.015),
      size: isCrystal ? rand(4.5, 8.5) : rand(1.8, 4.2),
      alpha: rand(0.45, 0.88),
      isCrystal,
    };
  }

  function drawHeart(x, y, size, color, alpha, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = color;
    ctx.beginPath();
    const s = size * 0.55;
    ctx.moveTo(0, s * 0.65);
    ctx.bezierCurveTo(-s * 1.4, -s * 0.35, -s * 0.9, -s * 1.5, 0, -s * 0.65);
    ctx.bezierCurveTo(s * 0.9, -s * 1.5, s * 1.4, -s * 0.35, 0, s * 0.65);
    ctx.fill();
    ctx.restore();
  }

  function drawFourPointStar(x, y, r, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.8);
    ctx.quadraticCurveTo(0, 0, r * 1.8, 0);
    ctx.quadraticCurveTo(0, 0, 0, r * 1.8);
    ctx.quadraticCurveTo(0, 0, -r * 1.8, 0);
    ctx.quadraticCurveTo(0, 0, 0, -r * 1.8);
    ctx.fill();
    ctx.restore();
  }

  function drawSnowflakeCrystal(x, y, r, alpha, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 1.1;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(137, 196, 238, 0.75)';
    ctx.shadowBlur = 6;
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate((Math.PI / 3) * i);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -r);
      ctx.moveTo(0, -r * 0.55);
      ctx.lineTo(-r * 0.28, -r * 0.78);
      ctx.moveTo(0, -r * 0.55);
      ctx.lineTo(r * 0.28, -r * 0.78);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function burst(originX, originY, count) {
    const cx = typeof originX === 'number' ? originX : width * 0.5;
    const cy = typeof originY === 'number' ? originY : height * 0.5;
    const total = count || 34;

    for (let i = 0; i < total; i++) {
      const angle = rand(-Math.PI, Math.PI);
      const speed = rand(1.4, 5.4);
      const isHeart = Math.random() < 0.52;
      burstParticles.push({
        x: cx + rand(-24, 24),
        y: cy + rand(-18, 18),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - rand(0.6, 2.2),
        gravity: 0.05,
        drag: 0.985,
        life: 1,
        decay: rand(0.011, 0.022),
        size: isHeart ? rand(7, 13) : rand(2, 4.5),
        rot: rand(-0.4, 0.4),
        kind: isHeart ? 'heart' : 'star',
        color: Math.random() < 0.55 ? '#6db3e8' : Math.random() < 0.5 ? '#ffffff' : '#b8cee2',
      });
    }
  }

  function explodeFirework(x, y, shape) {
    const palette = pick(FW_PALETTES);
    const kind = shape || (Math.random() < 0.32 ? 'heart' : Math.random() < 0.5 ? 'chrysanthemum' : 'ring');

    if (kind === 'heart') {
      const steps = 40;
      const scale = rand(0.2, 0.28);
      for (let i = 0; i < steps; i++) {
        const t = (Math.PI * 2 * i) / steps;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        fireworkSparks.push({
          x,
          y,
          prevX: x,
          prevY: y,
          vx: hx * scale + rand(-0.15, 0.15),
          vy: hy * scale + rand(-0.15, 0.15),
          gravity: 0.032,
          drag: 0.968,
          life: 1,
          decay: rand(0.011, 0.016),
          size: rand(2.0, 3.2),
          color: i % 2 === 0 ? palette[0] : palette[2],
          twinkle: Math.random() < 0.5,
        });
      }
      return;
    }

    const count = kind === 'ring' ? 42 : 58;
    for (let i = 0; i < count; i++) {
      const angle = kind === 'ring' ? (Math.PI * 2 * i) / count : rand(0, Math.PI * 2);
      const speed = kind === 'ring' ? rand(3.6, 4.3) : rand(1.4, 5.6);
      fireworkSparks.push({
        x,
        y,
        prevX: x,
        prevY: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0.048,
        drag: 0.962,
        life: 1,
        decay: rand(0.011, 0.02),
        size: rand(1.8, 3.4),
        color: pick(palette),
        twinkle: Math.random() < 0.45,
      });
    }

    // Inner bright core glitter
    for (let j = 0; j < 14; j++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(0.5, 2.0);
      fireworkSparks.push({
        x,
        y,
        prevX: x,
        prevY: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0.03,
        drag: 0.95,
        life: 0.9,
        decay: rand(0.018, 0.03),
        size: rand(1.5, 2.5),
        color: '#FFFFFF',
        twinkle: true,
      });
    }
  }

  function launchFirework(targetX, targetY, shape) {
    const tx = typeof targetX === 'number' ? targetX : rand(width * 0.14, width * 0.86);
    const ty = typeof targetY === 'number' ? targetY : rand(height * 0.12, height * 0.42);
    const startX = tx + rand(-60, 60);
    const startY = height + 10;
    const frames = Math.round(rand(28, 38));
    const vx = (tx - startX) / frames;
    const vy = (ty - startY) / frames;

    rockets.push({
      x: startX,
      y: startY,
      prevX: startX,
      prevY: startY,
      vx,
      vy,
      framesLeft: frames,
      shape,
      color: pick(['#89C4EE', '#FFFFFF', '#FFE6A7']),
    });
  }

  function launchSalvo(count) {
    const total = count || 4;
    for (let i = 0; i < total; i++) {
      setTimeout(() => {
        const x = rand(width * 0.14, width * 0.86);
        const y = rand(height * 0.14, height * 0.42);
        const shape = i === 1 ? 'heart' : undefined;
        launchFirework(x, y, shape);
      }, i * 260);
    }
  }

  function tick(now) {
    ctx.clearRect(0, 0, width, height);

    // Periodic gentle festive fireworks when enabled
    if (autoFireworksEnabled && now - lastAutoFwTime > 4200) {
      lastAutoFwTime = now;
      launchFirework();
    }

    // 1. Ambient sparkles & mini hearts
    for (let i = 0; i < ambientParticles.length; i++) {
      const p = ambientParticles[i];
      p.x += p.vx + Math.sin(p.phase * 0.7) * 0.12;
      p.y += p.vy;
      p.phase += p.twinkleSpeed;

      if (p.y < -20 || p.x < -30 || p.x > width + 30) {
        ambientParticles[i] = createAmbient(false);
        continue;
      }

      const twinkle = 0.45 + 0.55 * Math.sin(p.phase);
      const alpha = p.alpha * twinkle;
      const color =
        p.hue === 'silver'
          ? 'rgba(255, 255, 255, 0.95)'
          : 'rgba(130, 194, 240, 0.9)';

      if (p.kind === 'heart') {
        drawHeart(p.x, p.y, p.size, p.hue === 'silver' ? '#d4e2f0' : '#89c4ee', alpha * 0.85, Math.sin(p.phase) * 0.16);
      } else if (p.kind === 'star') {
        drawFourPointStar(p.x, p.y, p.size, color, alpha);
      } else {
        ctx.save();
        ctx.globalAlpha = alpha * 0.65;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 1.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 2. Gentle Christmas Snowfall
    if (snowEnabled) {
      for (let i = 0; i < snowParticles.length; i++) {
        const s = snowParticles[i];
        s.swayPhase += s.swaySpeed;
        s.x += s.vx + Math.sin(s.swayPhase) * s.swayAmp;
        s.y += s.vy;
        s.rot += s.rotSpeed;

        if (s.y > height + 20 || s.x < -30 || s.x > width + 30) {
          snowParticles[i] = createSnow(false);
          continue;
        }

        if (s.isCrystal) {
          drawSnowflakeCrystal(s.x, s.y, s.size, s.alpha, s.rot);
        } else {
          ctx.save();
          ctx.globalAlpha = s.alpha;
          ctx.fillStyle = '#FFFFFF';
          ctx.shadowColor = 'rgba(153, 204, 242, 0.7)';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // 3. Burst hearts & stars
    for (let i = burstParticles.length - 1; i >= 0; i--) {
      const b = burstParticles[i];
      b.vx *= b.drag;
      b.vy = b.vy * b.drag + b.gravity;
      b.x += b.vx;
      b.y += b.vy;
      b.life -= b.decay;

      if (b.life <= 0) {
        burstParticles.splice(i, 1);
        continue;
      }

      if (b.kind === 'heart') {
        drawHeart(b.x, b.y, b.size, b.color, b.life, b.rot);
      } else {
        drawFourPointStar(b.x, b.y, b.size, b.color, b.life);
      }
    }

    // 4. Firework Rockets
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.prevX = r.x;
      r.prevY = r.y;
      r.x += r.vx;
      r.y += r.vy;
      r.framesLeft -= 1;

      ctx.save();
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(r.prevX, r.prevY);
      ctx.lineTo(r.x, r.y);
      ctx.stroke();
      ctx.restore();

      if (r.framesLeft <= 0) {
        explodeFirework(r.x, r.y, r.shape);
        rockets.splice(i, 1);
      }
    }

    // 5. Firework Sparks
    for (let i = fireworkSparks.length - 1; i >= 0; i--) {
      const f = fireworkSparks[i];
      f.prevX = f.x;
      f.prevY = f.y;
      f.vx *= f.drag;
      f.vy = f.vy * f.drag + f.gravity;
      f.x += f.vx;
      f.y += f.vy;
      f.life -= f.decay;

      if (f.life <= 0) {
        fireworkSparks.splice(i, 1);
        continue;
      }

      const flicker = f.twinkle ? 0.55 + 0.45 * Math.sin(f.life * 28) : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * flicker));
      ctx.strokeStyle = f.color;
      ctx.fillStyle = f.color;
      ctx.lineWidth = f.size;
      ctx.lineCap = 'round';
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 9;
      ctx.beginPath();
      ctx.moveTo(f.prevX, f.prevY);
      ctx.lineTo(f.x, f.y);
      ctx.stroke();
      ctx.restore();
    }

    requestAnimationFrame(tick);
  }

  resize();
  for (let i = 0; i < AMBIENT_COUNT; i++) ambientParticles.push(createAmbient(true));
  for (let i = 0; i < SNOW_COUNT; i++) snowParticles.push(createSnow(true));
  window.addEventListener('resize', resize);
  requestAnimationFrame(tick);

  global.SparkleFX = {
    burst,
    launchFirework,
    launchSalvo,
    setSnow(val) {
      snowEnabled = Boolean(val);
    },
    setAutoFireworks(val) {
      autoFireworksEnabled = Boolean(val);
      lastAutoFwTime = performance.now();
    },
  };
})(window);
