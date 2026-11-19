/**
 * Interactive logic for Happy International Men's Day – 19.11 e-card.
 */
(function () {
  'use strict';

  const DEFAULTS = {
    to: 'Anh Yêu',
    from: 'Em của anh',
    wish: 'With all my love 💙',
    letter:
      "Chúc mừng Ngày Quốc tế Nam giới 19/11! Cảm ơn anh vì đã luôn là điểm tựa bình yên, luôn kiên nhẫn, dịu dàng và mang lại thật nhiều tiếng cười cho em trong từng khoảnh khắc bên nhau.\n\nTừ những buổi hẹn hò uống cà phê, những món ngon ăn cùng nhau cho tới những chuyến đi thật xa, chỉ cần đi cạnh anh thì ngày bình thường cũng trở thành kỷ niệm đẹp. Mong anh luôn khỏe mạnh, vững vàng, bình an và mãi giữ nụ cười hiền lành ấy nhé!",
  };

  let state = { ...DEFAULTS };
  let heartCount = Number(localStorage.getItem('imd_1911_hearts') || 19);
  let customQrUrlOverride = null;

  // DOM refs
  const envelopeStage = document.getElementById('envelope-stage');
  const cardStage = document.getElementById('card-stage');
  const envelopeTrigger = document.getElementById('envelope-trigger');
  const envelopeCtaBtn = document.getElementById('envelope-cta-btn');
  const btnCloseEnvelope = document.getElementById('btn-close-envelope');
  const btnMusicToggle = document.getElementById('btn-music-toggle');
  const musicLabel = document.getElementById('music-label');
  const btnScrollQr = document.getElementById('btn-scroll-qr');
  const btnOpenCustomize = document.getElementById('btn-open-customize');
  const btnCustomizeFromQr = document.getElementById('btn-customize-from-qr');
  const btnSendHearts = document.getElementById('btn-send-hearts');
  const heartCounterEl = document.getElementById('heart-counter');

  const envRecipientName = document.getElementById('env-recipient-name');
  const cardRecipientDisplay = document.getElementById('card-recipient-display');
  const letterToName = document.getElementById('letter-to-name');
  const cardSenderDisplay = document.getElementById('card-sender-display');
  const cardWishHighlight = document.getElementById('card-wish-highlight');
  const letterClosingPhrase = document.getElementById('letter-closing-phrase');
  const letterBodyText = document.getElementById('letter-body-text');

  const qrCanvas = document.getElementById('qr-canvas');
  const qrUrlInput = document.getElementById('qr-url-input');
  const qrLocalhostHint = document.getElementById('qr-localhost-hint');
  const btnCopyLink = document.getElementById('btn-copy-link');
  const btnDownloadQr = document.getElementById('btn-download-qr');

  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');

  const customizeModal = document.getElementById('customize-modal');
  const customizeForm = document.getElementById('customize-form');
  const inputTo = document.getElementById('input-to');
  const inputFrom = document.getElementById('input-from');
  const inputWish = document.getElementById('input-wish');
  const inputLetter = document.getElementById('input-letter');
  const btnResetCard = document.getElementById('btn-reset-card');
  const toastEl = document.getElementById('toast');

  let toastTimer = null;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('is-visible');
    }, 2600);
  }

  /* ---------------- URL State & Rendering ---------------- */

  function loadStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('to') && params.get('to').trim()) state.to = params.get('to').trim();
    if (params.has('from') && params.get('from').trim()) state.from = params.get('from').trim();
    if (params.has('wish') && params.get('wish').trim()) state.wish = params.get('wish').trim();
    if (params.has('msg') && params.get('msg').trim()) state.letter = params.get('msg').trim();
  }

  function buildShareUrl(baseOriginPath) {
    const base = baseOriginPath || window.location.href.split('?')[0].split('#')[0];
    const params = new URLSearchParams();
    if (state.to !== DEFAULTS.to) params.set('to', state.to);
    if (state.from !== DEFAULTS.from) params.set('from', state.from);
    if (state.wish !== DEFAULTS.wish) params.set('wish', state.wish);
    if (state.letter !== DEFAULTS.letter) params.set('msg', state.letter);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  function applyStateToDOM() {
    envRecipientName.textContent = state.to;
    cardRecipientDisplay.textContent = state.to.toLowerCase();
    letterToName.textContent = state.to.toLowerCase();
    cardSenderDisplay.textContent = state.from;
    cardWishHighlight.textContent = state.wish;
    letterClosingPhrase.textContent = state.wish;
    heartCounterEl.textContent = String(heartCount);

    // Render paragraphs safely
    letterBodyText.innerHTML = '';
    const paragraphs = state.letter.split(/\n+/).filter((p) => p.trim().length > 0);
    for (const para of paragraphs) {
      const p = document.createElement('p');
      p.textContent = para.trim();
      letterBodyText.appendChild(p);
    }

    inputTo.value = state.to;
    inputFrom.value = state.from;
    inputWish.value = state.wish;
    inputLetter.value = state.letter;
  }

  function renderQR(urlText) {
    if (!window.MensDayQR || !qrCanvas) return;
    try {
      window.MensDayQR.renderToCanvas(qrCanvas, urlText, {
        pixelSize: 250,
        quietModules: 4,
        darkColor: '#1E3A5F',
        lightColor: '#FFFFFF',
        rounded: true,
      });
    } catch (err) {
      showToast('URL quá dài để tạo mã QR, hãy rút gọn bớt nhé!');
    }
  }

  const DEFAULT_PUBLIC_BASE = 'https://athletics-rush-thomson-competitive.trycloudflare.com/';

  function updateQrSection() {
    const loc = window.location;
    const isLocal =
      loc.protocol === 'file:' ||
      loc.hostname === 'localhost' ||
      loc.hostname === '127.0.0.1';
    const defaultUrl = isLocal ? buildShareUrl(DEFAULT_PUBLIC_BASE) : buildShareUrl();
    const targetUrl = customQrUrlOverride || defaultUrl;
    qrUrlInput.value = targetUrl;
    renderQR(targetUrl);

    if (isLocal) {
      qrLocalhostHint.innerHTML =
        'Mã QR đang dùng sẵn <strong>Public Link</strong> (<code>' +
        DEFAULT_PUBLIC_BASE +
        '</code>) để điện thoại quét và mở trực tiếp từ mọi nơi.';
    } else {
      qrLocalhostHint.textContent =
        'Quét bằng camera iPhone/Android hoặc Zalo để mở thẳng thiệp chúc mừng 19/11 này.';
    }
  }

  /* ---------------- Envelope Animation ---------------- */

  let isTransitioning = false;

  function openEnvelope() {
    if (isTransitioning) return;
    isTransitioning = true;

    envelopeTrigger.classList.add('is-opening');

    const rect = envelopeTrigger.getBoundingClientRect();
    if (window.SparkleFX) {
      window.SparkleFX.burst(rect.left + rect.width / 2, rect.top + rect.height * 0.48, 42);
      setTimeout(() => {
        window.SparkleFX.burst(rect.left + rect.width / 2, rect.top + rect.height * 0.25, 28);
      }, 360);
    }

    // Start "Thế Giới Của Anh - Dangrangto" directly on user gesture
    startSongOnOpen();

    setTimeout(() => {
      envelopeStage.classList.add('is-fading-out');
      setTimeout(() => {
        envelopeStage.hidden = true;
        envelopeStage.classList.remove('is-fading-out');
        envelopeTrigger.classList.remove('is-opening');

        cardStage.hidden = false;
        window.scrollTo({ top: 0, behavior: 'instant' });
        triggerScrollReveals();
        updateQrSection();
        if (window.SparkleFX) {
          window.SparkleFX.launchSalvo(5);
          window.SparkleFX.setAutoFireworks(true);
        }
        isTransitioning = false;
      }, 520);
    }, 1050);
  }

  function closeEnvelope() {
    cardStage.hidden = true;
    envelopeStage.hidden = false;
    if (window.SparkleFX) window.SparkleFX.setAutoFireworks(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  envelopeTrigger.addEventListener('click', openEnvelope);
  envelopeCtaBtn.addEventListener('click', openEnvelope);
  btnCloseEnvelope.addEventListener('click', closeEnvelope);

  /* ---------------- Song: Thế Giới Của Anh — Dangrangto ---------------- */

  const YT_VIDEO_ID = 'E27ET_lINRo'; // Dangrangto - 'thế giới của anh' (Prod. DONAL)
  const musicDock = document.getElementById('music-dock');
  const musicEq = document.getElementById('music-eq');
  const btnDockPlay = document.getElementById('btn-dock-play');
  const btnDockCollapse = document.getElementById('btn-dock-collapse');

  let ytPlayer = null;
  let ytApiLoaded = false;
  let ytReady = false;
  let wantMusicPlaying = false;
  let musicPlaying = false;

  function setMusicUiState(playing) {
    musicPlaying = playing;
    btnMusicToggle.setAttribute('aria-pressed', playing ? 'true' : 'false');
    musicLabel.textContent = playing ? 'Đang phát: Thế Giới Của Anh' : 'Thế Giới Của Anh';
    if (btnDockPlay) btnDockPlay.textContent = playing ? '❚❚' : '▶';
    if (musicEq) musicEq.classList.toggle('is-playing', playing);
  }

  function ensureYouTubePlayer() {
    if (ytApiLoaded) return;
    ytApiLoaded = true;

    window.onYouTubeIframeAPIReady = function () {
      if (!window.YT || !window.YT.Player) return;
      ytPlayer = new window.YT.Player('yt-player-mount', {
        videoId: YT_VIDEO_ID,
        playerVars: {
          autoplay: wantMusicPlaying ? 1 : 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          loop: 1,
          playlist: YT_VIDEO_ID,
        },
        events: {
          onReady: function () {
            ytReady = true;
            if (wantMusicPlaying) {
              try {
                ytPlayer.setVolume(75);
                ytPlayer.playVideo();
              } catch {}
            }
          },
          onStateChange: function (ev) {
            if (!window.YT) return;
            if (ev.data === window.YT.PlayerState.PLAYING) {
              setMusicUiState(true);
            } else if (
              ev.data === window.YT.PlayerState.PAUSED ||
              ev.data === window.YT.PlayerState.ENDED
            ) {
              setMusicUiState(false);
            }
          },
          onError: function () {
            setMusicUiState(false);
            showToast('Không tải được trình phát YouTube — kiểm tra kết nối mạng nhé.');
          },
        },
      });
    };

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    document.head.appendChild(tag);
  }

  function startSongOnOpen() {
    if (musicDock) {
      musicDock.hidden = false;
      musicDock.classList.add('is-collapsed');
      if (btnDockCollapse) btnDockCollapse.textContent = '▴';
    }
    wantMusicPlaying = true;
    ensureYouTubePlayer();
    if (ytReady && ytPlayer) {
      try {
        ytPlayer.setVolume(75);
        ytPlayer.playVideo();
        setMusicUiState(true);
      } catch {}
    } else {
      setMusicUiState(true);
    }
  }

  function toggleMusic() {
    if (musicDock) musicDock.hidden = false;
    ensureYouTubePlayer();

    if (!musicPlaying) {
      wantMusicPlaying = true;
      if (ytReady && ytPlayer) {
        try {
          ytPlayer.playVideo();
        } catch {}
      }
      setMusicUiState(true);
    } else {
      wantMusicPlaying = false;
      if (ytReady && ytPlayer) {
        try {
          ytPlayer.pauseVideo();
        } catch {}
      }
      setMusicUiState(false);
    }
  }

  btnMusicToggle.addEventListener('click', toggleMusic);
  if (btnDockPlay) btnDockPlay.addEventListener('click', toggleMusic);
  if (btnDockCollapse && musicDock) {
    btnDockCollapse.addEventListener('click', () => {
      const collapsed = musicDock.classList.toggle('is-collapsed');
      btnDockCollapse.textContent = collapsed ? '▴' : '▾';
    });
  }

  // Preload YouTube API in background so envelope tap starts cleanly
  ensureYouTubePlayer();

  /* ---------------- Interactive Cards & Heart Counter ---------------- */

  document.querySelectorAll('.mini-note-card').forEach((card) => {
    card.addEventListener('click', () => {
      card.classList.toggle('is-flipped');
      const rect = card.getBoundingClientRect();
      if (window.SparkleFX) {
        window.SparkleFX.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 16);
      }
    });
  });

  btnSendHearts.addEventListener('click', () => {
    heartCount += 1;
    localStorage.setItem('imd_1911_hearts', String(heartCount));
    heartCounterEl.textContent = String(heartCount);
    const rect = btnSendHearts.getBoundingClientRect();
    if (window.SparkleFX) {
      window.SparkleFX.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 30);
    }
  });

  /* ---------------- Festive Fireworks, Snowfall & Snowglobe ---------------- */

  const btnFireworks = document.getElementById('btn-fireworks');
  const btnHeroFireworks = document.getElementById('btn-hero-fireworks');
  const btnSnowToggle = document.getElementById('btn-snow-toggle');
  const btnSnowglobeMagic = document.getElementById('btn-snowglobe-magic');
  let snowOn = true;

  function fireCelebration() {
    if (window.SparkleFX) {
      window.SparkleFX.launchSalvo(4);
    }
  }

  if (btnFireworks) btnFireworks.addEventListener('click', fireCelebration);
  if (btnHeroFireworks) btnHeroFireworks.addEventListener('click', fireCelebration);

  if (btnSnowToggle) {
    btnSnowToggle.addEventListener('click', () => {
      snowOn = !snowOn;
      btnSnowToggle.setAttribute('aria-pressed', snowOn ? 'true' : 'false');
      if (window.SparkleFX) window.SparkleFX.setSnow(snowOn);
      showToast(snowOn ? 'Đã bật hiệu ứng tuyết rơi ❄' : 'Đã tạm tắt tuyết rơi');
    });
  }

  if (btnSnowglobeMagic) {
    btnSnowglobeMagic.addEventListener('click', () => {
      const medallion = btnSnowglobeMagic.querySelector('.sticker-medallion');
      if (medallion) {
        medallion.classList.remove('is-shaking');
        void medallion.offsetWidth;
        medallion.classList.add('is-shaking');
      }
      const rect = btnSnowglobeMagic.getBoundingClientRect();
      if (window.SparkleFX) {
        window.SparkleFX.burst(rect.left + rect.width / 2, rect.top + rect.height * 0.4, 36);
        window.SparkleFX.launchSalvo(4);
      }
    });
  }

  /* ---------------- Scroll Reveal ---------------- */

  function triggerScrollReveals() {
    const blocks = document.querySelectorAll('.reveal-block');
    if (!('IntersectionObserver' in window)) {
      blocks.forEach((b) => b.classList.add('is-visible'));
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.01, rootMargin: '0px 0px -20px 0px' }
    );
    blocks.forEach((b) => obs.observe(b));
  }

  /* ---------------- Lightbox Modal ---------------- */

  function openLightbox(src, caption, alt) {
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    lightboxCaption.textContent = caption || '';
    lightboxModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightboxModal.hidden = true;
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.lightbox-trigger').forEach((img) => {
    img.addEventListener('click', () => {
      openLightbox(img.src, img.dataset.caption, img.alt);
    });
  });

  /* ---------------- Customize Modal & QR Tools ---------------- */

  function openCustomize() {
    customizeModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeCustomize() {
    customizeModal.hidden = true;
    document.body.style.overflow = '';
  }

  btnOpenCustomize.addEventListener('click', openCustomize);
  btnCustomizeFromQr.addEventListener('click', openCustomize);

  btnScrollQr.addEventListener('click', () => {
    document.getElementById('qr-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  document.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', () => {
      const target = el.getAttribute('data-close-modal');
      if (target === 'lightbox') closeLightbox();
      if (target === 'customize') closeCustomize();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!lightboxModal.hidden) closeLightbox();
      if (!customizeModal.hidden) closeCustomize();
    }
  });

  customizeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    state.to = inputTo.value.trim() || DEFAULTS.to;
    state.from = inputFrom.value.trim() || DEFAULTS.from;
    state.wish = inputWish.value.trim() || DEFAULTS.wish;
    state.letter = inputLetter.value.trim() || DEFAULTS.letter;

    applyStateToDOM();

    // Update browser URL cleanly on http/https
    if (window.location.protocol.startsWith('http') && window.history && window.history.replaceState) {
      window.history.replaceState(null, '', buildShareUrl());
    }

    // If user entered a custom host in the QR input, preserve its base origin
    if (customQrUrlOverride) {
      const customBase = customQrUrlOverride.split('?')[0].split('#')[0];
      customQrUrlOverride = buildShareUrl(customBase);
    }

    updateQrSection();
    closeCustomize();
    showToast('Đã lưu lời chúc & cập nhật mã QR 💙');
  });

  btnResetCard.addEventListener('click', () => {
    state = { ...DEFAULTS };
    customQrUrlOverride = null;
    applyStateToDOM();
    if (window.location.protocol.startsWith('http') && window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    updateQrSection();
    showToast('Đã khôi phục nội dung mặc định');
  });

  qrUrlInput.addEventListener('input', () => {
    const val = qrUrlInput.value.trim();
    customQrUrlOverride = val || null;
    if (val) {
      renderQR(val);
    }
  });

  btnCopyLink.addEventListener('click', async () => {
    const val = qrUrlInput.value.trim();
    if (!val) return;
    try {
      await navigator.clipboard.writeText(val);
      showToast('Đã sao chép đường dẫn thiệp 💙');
    } catch {
      qrUrlInput.select();
      document.execCommand('copy');
      showToast('Đã sao chép đường dẫn thiệp 💙');
    }
  });

  /* ---------------- Download Printable Baby-Blue & Silver QR Card PNG ---------------- */

  btnDownloadQr.addEventListener('click', () => {
    const out = document.createElement('canvas');
    out.width = 720;
    out.height = 920;
    const ctx = out.getContext('2d');

    // Cream & baby blue background gradient
    const bg = ctx.createLinearGradient(0, 0, 720, 920);
    bg.addColorStop(0, '#E2F1FC');
    bg.addColorStop(0.5, '#FDFAF2');
    bg.addColorStop(1, '#CFE7F7');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 720, 920);

    // Inner cream card
    ctx.fillStyle = '#FFFEFA';
    ctx.strokeStyle = '#B4C6DA';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(42, 42, 636, 836, 28);
    } else {
      ctx.rect(42, 42, 636, 836);
    }
    ctx.fill();
    ctx.stroke();

    // Header text
    ctx.fillStyle = '#4690CC';
    ctx.font = '600 18px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("INTERNATIONAL MEN'S DAY • 19.11", 360, 112);

    ctx.fillStyle = '#213954';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.fillText("Happy International Men's Day", 360, 166);
    ctx.fillText('– 19.11 –', 360, 208);

    ctx.fillStyle = '#4690CC';
    ctx.font = 'italic 28px Georgia, serif';
    ctx.fillText(state.wish, 360, 258);

    // QR frame
    const qrBoxSize = 400;
    const qrX = (720 - qrBoxSize) / 2;
    const qrY = 300;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#C4E2F8';
    ctx.lineWidth = 4;
    ctx.fillRect(qrX, qrY, qrBoxSize, qrBoxSize);
    ctx.strokeRect(qrX, qrY, qrBoxSize, qrBoxSize);

    ctx.drawImage(qrCanvas, qrX + 24, qrY + 24, qrBoxSize - 48, qrBoxSize - 48);

    // Footer instruction
    ctx.fillStyle = '#213954';
    ctx.font = '600 22px "Segoe UI", sans-serif';
    ctx.fillText(`Gửi tặng ${state.to} ♥`, 360, 760);

    ctx.fillStyle = '#5D7690';
    ctx.font = '18px "Segoe UI", sans-serif';
    ctx.fillText('Quét mã QR bằng điện thoại để mở thiệp điện tử', 360, 804);

    const link = document.createElement('a');
    link.download = 'thiep-19-11-qr.png';
    link.href = out.toDataURL('image/png');
    link.click();
    showToast('Đã tải ảnh thẻ QR (thiep-19-11-qr.png) 💙');
  });

  /* ---------------- Init ---------------- */

  loadStateFromUrl();
  applyStateToDOM();
  updateQrSection();
})();
