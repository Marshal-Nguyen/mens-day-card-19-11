/**
 * Pure-JS QR Code Model 2 Encoder (UTF-8 Byte Mode, ECC Level M, Versions 1-14)
 * Zero external dependencies, works 100% offline.
 */
(function (global) {
  'use strict';

  // GF(256) with primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11d)
  const GF_EXP = new Uint8Array(512);
  const GF_LOG = new Uint8Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) {
      GF_EXP[i] = GF_EXP[i - 255];
    }
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[GF_LOG[a] + GF_LOG[b]];
  }

  function rsGeneratorPoly(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(poly.length + 1).fill(0);
      const factor = GF_EXP[i];
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], factor);
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(data, ecCount) {
    const gen = rsGeneratorPoly(ecCount);
    const res = new Uint8Array(data.length + ecCount);
    res.set(data, 0);
    for (let i = 0; i < data.length; i++) {
      const coef = res[i];
      if (coef !== 0) {
        for (let j = 0; j < gen.length; j++) {
          res[i + j] ^= gfMul(gen[j], coef);
        }
      }
    }
    return res.slice(data.length);
  }

  // QR Version table for ECC Level M:
  // [totalCodewords, ecPerBlock, [[numBlocks, dataCodewordsPerBlock], ...]]
  // Source: ISO/IEC 18004 Table 9 (Level M)
  const VERSION_M = {
    1:  [26,  10, [[1, 16]]],
    2:  [44,  16, [[1, 28]]],
    3:  [70,  26, [[1, 44]]],
    4:  [100, 18, [[2, 32]]],
    5:  [134, 24, [[2, 43]]],
    6:  [172, 16, [[4, 27]]],
    7:  [196, 18, [[4, 31]]],
    8:  [242, 22, [[2, 38], [2, 39]]],
    9:  [292, 22, [[3, 36], [2, 37]]],
    10: [346, 26, [[4, 43], [1, 44]]],
    11: [404, 30, [[1, 50], [4, 51]]],
    12: [466, 22, [[6, 36], [2, 37]]],
    13: [532, 22, [[8, 37], [1, 38]]],
    14: [581, 24, [[4, 40], [5, 41]]],
  };

  // Alignment pattern center coordinates per version (ISO/IEC 18004 Annex E)
  const ALIGN_POS = {
    1: [],
    2: [6, 18],
    3: [6, 22],
    4: [6, 26],
    5: [6, 30],
    6: [6, 34],
    7: [6, 22, 38],
    8: [6, 24, 42],
    9: [6, 26, 46],
    10: [6, 28, 50],
    11: [6, 30, 54],
    12: [6, 32, 58],
    13: [6, 34, 62],
    14: [6, 26, 46, 66],
  };

  function encodeUTF8(str) {
    if (typeof TextEncoder !== 'undefined') {
      return Array.from(new TextEncoder().encode(str));
    }
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
    return bytes;
  }

  function pickVersion(byteLen) {
    for (let v = 1; v <= 14; v++) {
      const spec = VERSION_M[v];
      let dataCap = 0;
      for (const [cnt, dcw] of spec[2]) dataCap += cnt * dcw;
      const charCountBits = v < 10 ? 8 : 16;
      const totalBitsNeeded = 4 + charCountBits + byteLen * 8;
      if (totalBitsNeeded <= dataCap * 8) {
        return { version: v, dataCap, spec };
      }
    }
    throw new Error('URL too long for QR encoder (max ~450 bytes)');
  }

  function buildCodewords(bytes) {
    const { version, dataCap, spec } = pickVersion(bytes.length);
    const bits = [];
    const pushBits = (val, len) => {
      for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
    };

    // Mode 0100 (Byte)
    pushBits(0b0100, 4);
    pushBits(bytes.length, version < 10 ? 8 : 16);
    for (const b of bytes) pushBits(b, 8);

    // Terminator (up to 4 zero bits)
    const maxBits = dataCap * 8;
    const termLen = Math.min(4, maxBits - bits.length);
    pushBits(0, termLen);
    // Pad to byte boundary
    while (bits.length % 8 !== 0) bits.push(0);
    // Pad bytes 0xEC, 0x11
    const dataBytes = [];
    for (let i = 0; i < bits.length; i += 8) {
      let val = 0;
      for (let j = 0; j < 8; j++) val = (val << 1) | bits[i + j];
      dataBytes.push(val);
    }
    let padToggle = 0;
    while (dataBytes.length < dataCap) {
      dataBytes.push(padToggle === 0 ? 0xec : 0x11);
      padToggle ^= 1;
    }

    // Split into blocks & compute RS ECC
    const ecPerBlock = spec[1];
    const blocks = [];
    const ecBlocks = [];
    let offset = 0;
    for (const [count, dcw] of spec[2]) {
      for (let b = 0; b < count; b++) {
        const slice = dataBytes.slice(offset, offset + dcw);
        offset += dcw;
        blocks.push(slice);
        ecBlocks.push(Array.from(rsEncode(Uint8Array.from(slice), ecPerBlock)));
      }
    }

    // Interleave data codewords, then ECC codewords
    const finalCw = [];
    const maxDataLen = Math.max(...blocks.map((b) => b.length));
    for (let i = 0; i < maxDataLen; i++) {
      for (const blk of blocks) {
        if (i < blk.length) finalCw.push(blk[i]);
      }
    }
    for (let i = 0; i < ecPerBlock; i++) {
      for (const ec of ecBlocks) {
        if (i < ec.length) finalCw.push(ec[i]);
      }
    }

    return { version, codewords: finalCw };
  }

  function createMatrix(version) {
    const size = version * 4 + 17;
    const modules = Array.from({ length: size }, () => new Int8Array(size)); // 0/1
    const isFunc = Array.from({ length: size }, () => new Uint8Array(size));  // 1 if reserved

    function setFunc(r, c, val) {
      if (r >= 0 && r < size && c >= 0 && c < size) {
        modules[r][c] = val ? 1 : 0;
        isFunc[r][c] = 1;
      }
    }

    function drawFinder(top, left) {
      for (let dr = -1; dr <= 7; dr++) {
        for (let dc = -1; dc <= 7; dc++) {
          const r = top + dr;
          const c = left + dc;
          if (r < 0 || r >= size || c < 0 || c >= size) continue;
          const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
          const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
          const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          setFunc(r, c, inOuter && (onBorder || inInner));
        }
      }
    }

    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      const bit = i % 2 === 0 ? 1 : 0;
      setFunc(6, i, bit);
      setFunc(i, 6, bit);
    }

    // Alignment patterns
    const pos = ALIGN_POS[version];
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        const cr = pos[i];
        const cc = pos[j];
        if (isFunc[cr][cc]) continue; // Skip finder overlaps
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
            setFunc(cr + dr, cc + dc, dark);
          }
        }
      }
    }

    // Dark module + format info placeholders
    setFunc(size - 8, 8, 1);
    for (let i = 0; i < 9; i++) {
      if (i !== 6) {
        isFunc[8][i] = 1;
        isFunc[i][8] = 1;
      }
    }
    for (let i = 0; i < 8; i++) {
      isFunc[8][size - 1 - i] = 1;
      isFunc[size - 1 - i][8] = 1;
    }

    // Version info placeholders for v >= 7
    if (version >= 7) {
      let vBits = version;
      let rem = version << 12;
      for (let i = 17; i >= 12; i--) {
        if ((rem >> i) & 1) rem ^= 0x1f25 << (i - 12);
      }
      const verInfo = (vBits << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const bit = (verInfo >> i) & 1;
        const a = size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        setFunc(a, b, bit);
        setFunc(b, a, bit);
      }
    }

    return { size, modules, isFunc };
  }

  function placeData(matrix, codewords) {
    const { size, modules, isFunc } = matrix;
    let cwIdx = 0;
    let bitIdx = 7;

    function nextBit() {
      if (cwIdx >= codewords.length) return 0;
      const b = (codewords[cwIdx] >> bitIdx) & 1;
      bitIdx--;
      if (bitIdx < 0) {
        bitIdx = 7;
        cwIdx++;
      }
      return b;
    }

    let up = true;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5; // Skip vertical timing column
      for (let step = 0; step < size; step++) {
        const r = up ? size - 1 - step : step;
        for (let lr = 0; lr < 2; lr++) {
          const c = right - lr;
          if (!isFunc[r][c]) {
            modules[r][c] = nextBit();
          }
        }
      }
      up = !up;
    }
  }

  function maskCondition(mask, r, c) {
    switch (mask) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
      default: return false;
    }
  }

  function formatBitsForMask(mask) {
    // ECC Level M = 00 (binary 00)
    const data = (0b00 << 3) | mask;
    let rem = data << 10;
    for (let i = 14; i >= 10; i--) {
      if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
    }
    return ((data << 10) | rem) ^ 0x5412;
  }

  function applyFormat(modules, size, mask) {
    const fmt = formatBitsForMask(mask);
    for (let i = 0; i < 6; i++) modules[8][i] = (fmt >> i) & 1;
    modules[8][7] = (fmt >> 6) & 1;
    modules[8][8] = (fmt >> 7) & 1;
    modules[7][8] = (fmt >> 8) & 1;
    for (let i = 9; i < 15; i++) modules[14 - i][8] = (fmt >> i) & 1;

    for (let i = 0; i < 8; i++) modules[size - 1 - i][8] = (fmt >> i) & 1;
    for (let i = 8; i < 15; i++) modules[8][size - 15 + i] = (fmt >> i) & 1;
  }

  function penaltyScore(modules, size) {
    let score = 0;
    // N1: 5+ consecutive same-color modules in row/col
    for (let r = 0; r < size; r++) {
      let run = 1;
      for (let c = 1; c < size; c++) {
        if (modules[r][c] === modules[r][c - 1]) {
          run++;
          if (run === 5) score += 3;
          else if (run > 5) score += 1;
        } else {
          run = 1;
        }
      }
    }
    for (let c = 0; c < size; c++) {
      let run = 1;
      for (let r = 1; r < size; r++) {
        if (modules[r][c] === modules[r - 1][c]) {
          run++;
          if (run === 5) score += 3;
          else if (run > 5) score += 1;
        } else {
          run = 1;
        }
      }
    }
    // N2: 2x2 blocks
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const v = modules[r][c];
        if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) {
          score += 3;
        }
      }
    }
    // N3: finder-like pattern 1011101 + 4 white modules
    const checkN3 = (arr) => {
      for (let i = 0; i <= size - 11; i++) {
        if (
          arr[i] === 1 && arr[i + 1] === 0 && arr[i + 2] === 1 && arr[i + 3] === 1 &&
          arr[i + 4] === 1 && arr[i + 5] === 0 && arr[i + 6] === 1 &&
          arr[i + 7] === 0 && arr[i + 8] === 0 && arr[i + 9] === 0 && arr[i + 10] === 0
        ) score += 40;
        if (
          arr[i] === 0 && arr[i + 1] === 0 && arr[i + 2] === 0 && arr[i + 3] === 0 &&
          arr[i + 4] === 1 && arr[i + 5] === 0 && arr[i + 6] === 1 && arr[i + 7] === 1 &&
          arr[i + 8] === 1 && arr[i + 9] === 0 && arr[i + 10] === 1
        ) score += 40;
      }
    };
    for (let r = 0; r < size; r++) checkN3(modules[r]);
    for (let c = 0; c < size; c++) {
      const col = new Int8Array(size);
      for (let r = 0; r < size; r++) col[r] = modules[r][c];
      checkN3(col);
    }
    // N4: dark ratio
    let dark = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) if (modules[r][c]) dark++;
    }
    const pct = (dark * 100) / (size * size);
    const k = Math.floor(Math.abs(pct - 50) / 5);
    score += k * 10;
    return score;
  }

  function generateMatrix(text) {
    const bytes = encodeUTF8(text);
    const { version, codewords } = buildCodewords(bytes);
    const base = createMatrix(version);
    placeData(base, codewords);

    let bestMask = 0;
    let bestScore = Infinity;
    let bestModules = null;

    for (let mask = 0; mask < 8; mask++) {
      const cloned = base.modules.map((row) => new Int8Array(row));
      for (let r = 0; r < base.size; r++) {
        for (let c = 0; c < base.size; c++) {
          if (!base.isFunc[r][c] && maskCondition(mask, r, c)) {
            cloned[r][c] ^= 1;
          }
        }
      }
      applyFormat(cloned, base.size, mask);
      const s = penaltyScore(cloned, base.size);
      if (s < bestScore) {
        bestScore = s;
        bestMask = mask;
        bestModules = cloned;
      }
    }

    return { size: base.size, modules: bestModules, version, mask: bestMask };
  }

  function fillRoundedRect(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }

  function renderToCanvas(canvas, text, options) {
    const opts = Object.assign(
      {
        pixelSize: 280,
        quietModules: 4,
        darkColor: '#1E3A5F',
        lightColor: '#FFFFFF',
        rounded: true,
      },
      options || {}
    );

    const qr = generateMatrix(text);
    const totalModules = qr.size + opts.quietModules * 2;
    const scale = Math.max(4, Math.floor(opts.pixelSize / totalModules));
    const dim = totalModules * scale;

    canvas.width = dim;
    canvas.height = dim;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = opts.lightColor;
    ctx.fillRect(0, 0, dim, dim);

    ctx.fillStyle = opts.darkColor;
    const offset = opts.quietModules * scale;

    for (let r = 0; r < qr.size; r++) {
      for (let c = 0; c < qr.size; c++) {
        if (!qr.modules[r][c]) continue;
        const x = offset + c * scale;
        const y = offset + r * scale;
        const inFinder =
          (r < 7 && c < 7) ||
          (r < 7 && c >= qr.size - 7) ||
          (r >= qr.size - 7 && c < 7);

        if (opts.rounded && !inFinder && scale >= 5) {
          const rad = Math.max(1, scale * 0.24);
          fillRoundedRect(ctx, x + 0.2, y + 0.2, scale - 0.4, scale - 0.4, rad);
        } else {
          ctx.fillRect(x, y, scale, scale);
        }
      }
    }

    return qr;
  }

  global.MensDayQR = {
    generateMatrix,
    renderToCanvas,
  };
})(window);
