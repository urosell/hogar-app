// Genera los iconos PNG de la PWA (192, 512, 512-maskable) sin dependencias
// externas: dibuja una casa geométrica en un buffer RGBA y lo codifica como PNG
// usando solo el módulo zlib nativo de Node.
import zlib from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'icons')
mkdirSync(OUT, { recursive: true })

const COL = {
  fondo: [88, 129, 87, 255], // oliva #588157
  casa: [245, 241, 232, 255], // crema #F5F1E8
  puerta: [163, 177, 138, 255], // salvia #A3B18A
}

// CRC32 para los chunks PNG.
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePng(size, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  // filtro 0 por scanline
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4
      const dst = y * (size * 4 + 1) + 1 + x * 4
      raw[dst] = pixels[src]
      raw[dst + 1] = pixels[src + 1]
      raw[dst + 2] = pixels[src + 2]
      raw[dst + 3] = pixels[src + 3]
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

function dibujar(size, { redondear }) {
  const px = new Uint8Array(size * size * 4)
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3]
  }

  const r = redondear ? size * 0.22 : 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Esquinas redondeadas (solo iconos no-maskable).
      if (r > 0) {
        const cx = Math.min(x, size - 1 - x)
        const cy = Math.min(y, size - 1 - y)
        if (cx < r && cy < r) {
          const dx = r - cx, dy = r - cy
          if (dx * dx + dy * dy > r * r) { set(x, y, [0, 0, 0, 0]); continue }
        }
      }
      set(x, y, COL.fondo)
    }
  }

  // Casa centrada (escala segura para maskable).
  const s = size
  const cx = s / 2
  const roofTop = s * 0.26
  const eaves = s * 0.46 // donde acaba el tejado / empieza el cuerpo
  const roofHalf = s * 0.26
  const bodyHalf = s * 0.19
  const bodyBottom = s * 0.74

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      // Tejado (triángulo)
      if (y >= roofTop && y <= eaves) {
        const t = (y - roofTop) / (eaves - roofTop)
        const half = roofHalf * t
        if (Math.abs(x - cx) <= half) set(x, y, COL.casa)
      }
      // Cuerpo (rectángulo)
      if (y > eaves && y <= bodyBottom) {
        if (Math.abs(x - cx) <= bodyHalf) set(x, y, COL.casa)
      }
    }
  }

  // Puerta
  const doorTop = s * 0.56
  const doorHalf = s * 0.055
  for (let y = doorTop; y <= bodyBottom; y++) {
    for (let x = cx - doorHalf; x <= cx + doorHalf; x++) {
      set(Math.round(x), Math.round(y), COL.puerta)
    }
  }

  return px
}

const targets = [
  { file: 'icon-192.png', size: 192, redondear: true },
  { file: 'icon-512.png', size: 512, redondear: true },
  { file: 'icon-512-maskable.png', size: 512, redondear: false },
]
for (const t of targets) {
  const px = dibujar(t.size, { redondear: t.redondear })
  writeFileSync(join(OUT, t.file), encodePng(t.size, px))
  console.log('✓', t.file)
}
console.log('Iconos generados en public/icons')
