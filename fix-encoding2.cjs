'use strict';
const fs = require('fs');

/**
 * Encoding fix for UTF-8 files corrupted by PowerShell's default CP1252 reading.
 *
 * Corruption chain for Spanish chars (2-byte UTF-8 [C3,XX]):
 *   PS read [C3,XX] as CP1252 2 chars → wrote back as UTF-8 [C3,83,C2,XX] (4 bytes)
 *   First fix-script then corrupted ú [C3,83,C2,BA] → [C3,83,BA] and á [C3,83,C2,A1] → [C3,83,A1]
 *
 * Corruption chain for U+2xxx chars (3-byte UTF-8 [E2,XX,YY]):
 *   PS read each byte via CP1252 → wrote back as UTF-8 → each byte became 2-3 bytes
 *   Then first fix-script replaced [E2,80,9D] → [1D], [E2,80,9C] → [1C], [E2,80,99] → [19]
 *
 * This script reverses all corruptions to restore original UTF-8.
 */

const files = [
  'src/pages/ventas/facturas/FacturaFormPage.tsx',
  'src/pages/ventas/facturas/FacturasPage.tsx',
  'src/pages/ventas/estimaciones/EstimacionesPage.tsx',
  'src/pages/ventas/estimaciones/EstimacionFormPage.tsx',
  'src/pages/compras/ordenes/OrdenCompraFormPage.tsx',
  'src/pages/compras/facturas/FacturaProveedorFormPage.tsx',
  'src/pages/compras/ordenes/OrdenesCompraPage.tsx',
  'src/pages/compras/facturas/FacturasProveedorPage.tsx',
];

/**
 * Fix all encoding corruptions in a buffer.
 * Returns a new Buffer with corrected bytes, or null if no changes needed.
 */
function fixBuffer(buf) {
  const out = [];
  let i = 0;
  let changed = false;

  // Strip UTF-8 BOM (EF BB BF) at start
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    console.log('  Stripped BOM');
    i = 3;
    changed = true;
  }

  while (i < buf.length) {
    const b0 = buf[i];
    const b1 = buf[i + 1];
    const b2 = buf[i + 2];
    const b3 = buf[i + 3];
    const b4 = buf[i + 4];
    const b5 = buf[i + 5];
    const b6 = buf[i + 6];

    // ── U+2xxx 3-byte chars (corrupted via CP1252 misread + partial fix) ──────

    // [C3,A2,E2,80,A0,19] → → (U+2192 RIGHTWARDS ARROW = [E2,86,92])
    // Original: [E2,86,92]; CP1252: E2→â→[C3,A2], 86→†→[E2,80,A0], 92→'→[E2,80,99]→[19]
    if (b0===0xC3 && b1===0xA2 && b2===0xE2 && b3===0x80 && b4===0xA0 && b5===0x19) {
      out.push(0xE2, 0x86, 0x92); i += 6; changed = true; continue;
    }

    // [C3,A2,E2,82,AC,C2,A6] → … (U+2026 HORIZONTAL ELLIPSIS = [E2,80,A6])
    // Original: [E2,80,A6]; CP1252: E2→â→[C3,A2], 80→€→[E2,82,AC], A6→¦→[C2,A6]
    if (b0===0xC3 && b1===0xA2 && b2===0xE2 && b3===0x82 && b4===0xAC && b5===0xC2 && b6===0xA6) {
      out.push(0xE2, 0x80, 0xA6); i += 7; changed = true; continue;
    }

    // [C3,A2,E2,82,AC,1D] → — (U+2014 EM DASH = [E2,80,94])
    // Original: [E2,80,94]; CP1252: E2→â→[C3,A2], 80→€→[E2,82,AC], 94→"→[E2,80,9D]→[1D]
    if (b0===0xC3 && b1===0xA2 && b2===0xE2 && b3===0x82 && b4===0xAC && b5===0x1D) {
      out.push(0xE2, 0x80, 0x94); i += 6; changed = true; continue;
    }

    // [C3,A2,1D,E2,82,AC] → ─ (U+2500 BOX DRAWINGS LIGHT HORIZONTAL = [E2,94,80])
    // Original: [E2,94,80]; CP1252: E2→â→[C3,A2], 94→"→[E2,80,9D]→[1D], 80→€→[E2,82,AC]
    if (b0===0xC3 && b1===0xA2 && b2===0x1D && b3===0xE2 && b4===0x82 && b5===0xAC) {
      out.push(0xE2, 0x94, 0x80); i += 6; changed = true; continue;
    }

    // [C3,A2,C5,93,1C] → ✓ (U+2713 CHECK MARK = [E2,9C,93])
    // Original: [E2,9C,93]; CP1252: E2→â→[C3,A2], 9C→œ→[C5,93], 93→"→[E2,80,9C]→[1C]
    if (b0===0xC3 && b1===0xA2 && b2===0xC5 && b3===0x93 && b4===0x1C) {
      out.push(0xE2, 0x9C, 0x93); i += 5; changed = true; continue;
    }

    // [C3,A2,CB,86,19] → − (U+2212 MINUS SIGN = [E2,88,92])
    // Original: [E2,88,92]; CP1252: E2→â→[C3,A2], 88→ˆ→[CB,86], 92→'→[E2,80,99]→[19]
    if (b0===0xC3 && b1===0xA2 && b2===0xCB && b3===0x86 && b4===0x19) {
      out.push(0xE2, 0x88, 0x92); i += 5; changed = true; continue;
    }

    // ── Spanish chars (2-byte UTF-8 [C3,XX]) ────────────────────────────────

    // [C3,83,C2,XX] → [C3,XX]  (4-byte double-encoded, XX in 0x80–0xBF)
    // e.g. ó=[C3,B3] corrupted to [C3,83,C2,B3]
    if (b0===0xC3 && b1===0x83 && b2===0xC2 && b3 >= 0x80 && b3 <= 0xBF) {
      out.push(0xC3, b3); i += 4; changed = true; continue;
    }

    // [C3,83,XX] → [C3,XX]  (3-byte corrupted, XX in 0x80–0xBF)
    // e.g. ú was [C3,83,C2,BA] then first script made it [C3,83,BA]
    if (b0===0xC3 && b1===0x83 && b2 >= 0x80 && b2 <= 0xBF) {
      out.push(0xC3, b2); i += 3; changed = true; continue;
    }

    // Special: [C3,83,XX] where XX is an ASCII control char inserted by first fix-script
    // The first fix-script replaced [E2,80,9C]→[1C], [E2,80,9D]→[1D], [E2,80,99]→[19]
    // This corrupted uppercase chars whose second UTF-8 byte was in CP1252 "smart-quote" range:
    //   Ó=[C3,93] → PS→[C3,83,E2,80,9C] → fix→[C3,83,1C]
    //   Ô=[C3,94] → PS→[C3,83,E2,80,9D] → fix→[C3,83,1D]
    //   Ò=[C3,92] → PS→[C3,83,E2,80,99] → fix→[C3,83,19]
    if (b0===0xC3 && b1===0x83 && b2===0x1C) { out.push(0xC3, 0x93); i += 3; changed = true; continue; }
    if (b0===0xC3 && b1===0x83 && b2===0x1D) { out.push(0xC3, 0x94); i += 3; changed = true; continue; }
    if (b0===0xC3 && b1===0x83 && b2===0x19) { out.push(0xC3, 0x92); i += 3; changed = true; continue; }

    out.push(b0);
    i++;
  }

  if (!changed) return null;
  return Buffer.from(out);
}

const base = 'C:/Users/l_cha/contaerp-frontend/';

for (const rel of files) {
  const full = base + rel;
  const name = rel.split('/').pop();
  if (!fs.existsSync(full)) {
    console.log(name + ': FILE NOT FOUND, skipping');
    continue;
  }
  const buf = fs.readFileSync(full);
  console.log(name + ': ' + buf.length + ' bytes');
  const fixed = fixBuffer(buf);
  if (fixed) {
    fs.writeFileSync(full, fixed);
    console.log('  → Written: ' + fixed.length + ' bytes (saved ' + (buf.length - fixed.length) + ' bytes)');
  } else {
    console.log('  → No changes needed');
  }
}
console.log('Done.');
