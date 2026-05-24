const fs = require('fs');
const path = require('path');

const files = [
  'src/pages/ventas/facturas/FacturaFormPage.tsx',
  'src/pages/ventas/facturas/FacturasPage.tsx',
  'src/pages/ventas/facturas/FacturaDetallePage.tsx',
  'src/pages/ventas/estimaciones/EstimacionesPage.tsx',
  'src/pages/ventas/estimaciones/EstimacionFormPage.tsx',
  'src/pages/compras/ordenes/OrdenCompraFormPage.tsx',
  'src/pages/compras/facturas/FacturaProveedorFormPage.tsx',
  'src/pages/compras/ordenes/OrdenesCompraPage.tsx',
  'src/pages/compras/facturas/FacturasProveedorPage.tsx',
  'src/pages/configuracion/IntegracionesPage.tsx',
];

// When a UTF-8 file is incorrectly read as Latin-1 and saved back,
// UTF-8 multi-byte sequences appear as individual Latin-1 chars.
// We fix by reading as Latin-1, then replacing known broken sequences.
function fixEncoding(content) {
  // Two-byte UTF-8 sequences (0xC3 xx) - Latin/Spanish
  content = content.replace(/\xC3\xA1/g, 'á'); // á
  content = content.replace(/\xC3\xA9/g, 'é'); // é
  content = content.replace(/\xC3\xAD/g, 'í'); // í
  content = content.replace(/\xC3\xB3/g, 'ó'); // ó
  content = content.replace(/\xC3\xBA/g, 'ú'); // ú
  content = content.replace(/\xC3\xB1/g, 'ñ'); // ñ
  content = content.replace(/\xC3\x81/g, 'Á'); // Á
  content = content.replace(/\xC3\x89/g, 'É'); // É
  content = content.replace(/\xC3\x8D/g, 'Í'); // Í
  content = content.replace(/\xC3\x93/g, 'Ó'); // Ó
  content = content.replace(/\xC3\x9A/g, 'Ú'); // Ú
  content = content.replace(/\xC3\x91/g, 'Ñ'); // Ñ
  content = content.replace(/\xC3\xBC/g, 'ü'); // ü
  content = content.replace(/\xC2\xBF/g, '¿'); // ¿
  content = content.replace(/\xC2\xA1/g, '¡'); // ¡
  content = content.replace(/\xC2\xBA/g, 'º'); // º
  content = content.replace(/\xC2\xA8/g, '¨'); // ¨
  // Three-byte UTF-8 sequences - em dash, en dash, box drawing
  content = content.replace(/\xE2\x80\x94/g, '—'); // — em dash
  content = content.replace(/\xE2\x80\x93/g, '–'); // – en dash
  content = content.replace(/\xE2\x80\x9C/g, '“'); // "
  content = content.replace(/\xE2\x80\x9D/g, '”'); // "
  content = content.replace(/\xE2\x80\x98/g, '‘'); // '
  content = content.replace(/\xE2\x80\x99/g, '’'); // '
  content = content.replace(/\xE2\x94\x80/g, '─'); // ─ box drawing
  content = content.replace(/\xE2\x9C\x85/g, '✅'); // ✅
  content = content.replace(/\xF0\x9F\x94\x8C/g, '🔌'); // 🔌
  content = content.replace(/\xF0\x9F\x9B\x92/g, '🛒'); // 🛒
  content = content.replace(/\xF0\x9F\x94\x91/g, '🔑'); // 🔑
  return content;
}

let fixed = 0;
files.forEach(f => {
  const full = path.join(process.cwd(), f);
  if (!fs.existsSync(full)) {
    console.log('SKIP (not found):', f);
    return;
  }

  // Read as binary (latin1 gives 1:1 byte-to-char mapping)
  const content = fs.readFileSync(full, 'latin1');

  // Check if it actually has broken UTF-8 sequences
  const hasBroken = content.includes('\xC3') || content.includes('\xE2\x80') || content.includes('\xE2\x94');
  if (!hasBroken) {
    console.log('OK (clean):', f);
    return;
  }

  const fixed_content = fixEncoding(content);

  // Write back as UTF-8 without BOM
  const buf = Buffer.from(fixed_content, 'latin1');
  fs.writeFileSync(full, buf);
  fixed++;
  console.log('FIXED:', f);
});

console.log(`\nTotal fixed: ${fixed} files`);
