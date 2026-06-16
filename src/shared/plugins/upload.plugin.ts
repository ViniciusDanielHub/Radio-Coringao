// Por que validar dimensões?
//   - Imagens minúsculas (ex: 1×1 px) podem ser enviadas para bypass de
//     filtros ou para inserção de rastreadores.
//   - Imagens imensas (ex: 20000×20000 px) explodem memória durante
//     transformações no Cloudinary e aumentam custo de processamento.
//   - Dimensões mínimas garantem qualidade visual mínima aceitável.
//
// Limites por pasta:
//   articles : mín 400×200 px  | máx 8000×8000 px
//   avatars  : mín 50×50 px    | máx 4000×4000 px
//   banners  : mín 800×200 px  | máx 8000×4000 px
//
// A leitura de dimensões é feita parseando o header do arquivo em memória
// (sem dependências externas) — ver parseDimensions() abaixo.
// Suporta JPEG, PNG e WebP.

import type { FastifyRequest, FastifyReply } from 'fastify';
import { uploadImage, type UploadFolder } from '../services/cloudinary';
import { UploadError } from '../errors';
import { ErrorCode } from '../errors/error-codes';

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// ─── Limites de dimensão por pasta ───────────────────────────
interface DimensionLimits {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
}

const DIMENSION_LIMITS: Record<UploadFolder, DimensionLimits> = {
  articles: { minWidth: 400, minHeight: 200, maxWidth: 8000, maxHeight: 8000 },
  avatars: { minWidth: 50, minHeight: 50, maxWidth: 4000, maxHeight: 4000 },
  banners: { minWidth: 800, minHeight: 200, maxWidth: 8000, maxHeight: 4000 },
};

// ─── Magic bytes ──────────────────────────────────────────────
const MAGIC_BYTES: { signature: number[]; type: string }[] = [
  { signature: [0xFF, 0xD8, 0xFF], type: 'image/jpeg' },
  { signature: [0x89, 0x50, 0x4E, 0x47], type: 'image/png' },
  { signature: [0x52, 0x49, 0x46, 0x46], type: 'image/webp' },
];

function detectMimeFromBuffer(buf: Buffer): string | null {
  for (const { signature, type } of MAGIC_BYTES) {
    if (signature.every((byte, i) => buf[i] === byte)) {
      if (type === 'image/webp') {
        const webpMarker = buf.slice(8, 12).toString('ascii');
        if (webpMarker !== 'WEBP') continue;
      }
      return type;
    }
  }
  return null;
}

// ─── Parser de dimensões sem dependências externas ───────────
//
// Lê apenas os headers necessários de cada formato para obter
// width × height sem decodificar o arquivo inteiro.

interface ImageDimensions { width: number; height: number }

function parseDimensions(buf: Buffer, mime: string): ImageDimensions | null {
  try {
    if (mime === 'image/png') return parsePngDimensions(buf);
    if (mime === 'image/jpeg') return parseJpegDimensions(buf);
    if (mime === 'image/webp') return parseWebpDimensions(buf);
  } catch {
    // Falha silenciosa — se não conseguir ler as dimensões, não bloqueamos o upload
  }
  return null;
}

/** PNG: bytes 16–23 do IHDR chunk contêm width (4 bytes) e height (4 bytes) */
function parsePngDimensions(buf: Buffer): ImageDimensions | null {
  if (buf.length < 24) return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return (width > 0 && height > 0) ? { width, height } : null;
}

/** JPEG: percorre segmentos SOF (Start Of Frame) para encontrar H × W */
function parseJpegDimensions(buf: Buffer): ImageDimensions | null {
  let offset = 2; // pula o marcador SOI (FF D8)
  while (offset + 4 < buf.length) {
    if (buf[offset] !== 0xFF) break;
    const marker = buf[offset + 1];
    const length = buf.readUInt16BE(offset + 2);

    // SOF markers: C0–C3, C5–C7, C9–CB, CD–CF
    const isSOF = (marker >= 0xC0 && marker <= 0xC3) ||
      (marker >= 0xC5 && marker <= 0xC7) ||
      (marker >= 0xC9 && marker <= 0xCB) ||
      (marker >= 0xCD && marker <= 0xCF);

    if (isSOF && offset + 8 < buf.length) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return (width > 0 && height > 0) ? { width, height } : null;
    }

    offset += 2 + length;
  }
  return null;
}

/** WebP: suporta VP8, VP8L e VP8X */
function parseWebpDimensions(buf: Buffer): ImageDimensions | null {
  if (buf.length < 30) return null;
  const chunkType = buf.slice(12, 16).toString('ascii');

  if (chunkType === 'VP8 ' && buf.length >= 30) {
    // Bitstream VP8 — bytes 26–29 codificam dimensões em 14 bits
    const w = (buf.readUInt16LE(26) & 0x3FFF) + 1;
    const h = (buf.readUInt16LE(28) & 0x3FFF) + 1;
    return { width: w, height: h };
  }

  if (chunkType === 'VP8L' && buf.length >= 25) {
    // Bitstream VP8L — 4 bytes em offset 21, empacotados
    const b = buf.readUInt32LE(21);
    const w = (b & 0x3FFF) + 1;
    const h = ((b >> 14) & 0x3FFF) + 1;
    return { width: w, height: h };
  }

  if (chunkType === 'VP8X' && buf.length >= 34) {
    // Extended WebP — bytes 24–29
    const w = buf.readUIntLE(24, 3) + 1;
    const h = buf.readUIntLE(27, 3) + 1;
    return { width: w, height: h };
  }

  return null;
}

// ─── Handler de upload ────────────────────────────────────────

export function createUploadHandler(folder: UploadFolder) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    let data: Awaited<ReturnType<typeof request.file>>;

    try {
      data = await request.file({ limits: { fileSize: MAX_SIZE_BYTES } });
    } catch (err: any) {
      if (
        err.message === 'File size limit reached' ||
        (err as any).code === 'FST_FILES_LIMIT' ||
        err.statusCode === 413
      ) {
        return reply.code(413).send({
          code: ErrorCode.UPLOAD_TOO_LARGE,
          error: `O arquivo excede o limite de ${MAX_SIZE_BYTES / 1024 / 1024}MB.`,
          maxMb: 5,
        });
      }
      return reply.code(400).send({
        code: ErrorCode.UPLOAD_NO_FILE,
        error: 'Erro ao processar o arquivo enviado.',
        details: process.env.NODE_ENV !== 'production' ? err.message : undefined,
      });
    }

    if (!data) return;

    // ── Valida tipo MIME declarado ──
    const declaredMime = data.mimetype?.toLowerCase() ?? '';
    if (!ACCEPTED_TYPES.includes(declaredMime)) {
      data.file.resume();
      return reply.code(415).send({
        code: ErrorCode.UPLOAD_INVALID_TYPE,
        error: 'Tipo de arquivo não suportado. Envie apenas imagens JPEG, PNG ou WebP.',
        received: declaredMime,
        accepted: ACCEPTED_TYPES,
      });
    }

    let buffer: Buffer;
    try {
      buffer = await data.toBuffer();
    } catch {
      return reply.code(400).send({
        code: ErrorCode.UPLOAD_CORRUPTED_FILE,
        error: 'Não foi possível ler o arquivo enviado. Tente novamente.',
      });
    }

    if (!buffer || buffer.length === 0) {
      return reply.code(400).send({
        code: ErrorCode.UPLOAD_EMPTY_FILE,
        error: 'O arquivo enviado está vazio.',
      });
    }

    if (buffer.length > MAX_SIZE_BYTES) {
      return reply.code(413).send({
        code: ErrorCode.UPLOAD_TOO_LARGE,
        error: `O arquivo tem ${(buffer.length / 1024 / 1024).toFixed(2)}MB. Máximo permitido: 5MB.`,
        maxMb: 5,
        sizeMb: +(buffer.length / 1024 / 1024).toFixed(2),
      });
    }

    // ── Valida magic bytes ──
    const realMime = detectMimeFromBuffer(buffer);
    if (!realMime) {
      return reply.code(415).send({
        code: ErrorCode.UPLOAD_CORRUPTED_FILE,
        error: 'O arquivo enviado não é uma imagem válida (verificação de conteúdo falhou).',
      });
    }
    const normalizedDeclared = declaredMime === 'image/jpg' ? 'image/jpeg' : declaredMime;
    if (realMime !== normalizedDeclared) {
      return reply.code(415).send({
        code: ErrorCode.UPLOAD_INVALID_TYPE,
        error: 'O conteúdo do arquivo não corresponde ao tipo declarado.',
        declared: declaredMime,
        detected: realMime,
      });
    }

    // ── Valida dimensões ──────────────────────────────────────
    const dims = parseDimensions(buffer, realMime);
    if (dims) {
      const limits = DIMENSION_LIMITS[folder];

      if (dims.width < limits.minWidth || dims.height < limits.minHeight) {
        return reply.code(422).send({
          code: ErrorCode.UPLOAD_INVALID_TYPE,
          error: `Imagem muito pequena para "${folder}". Mínimo: ${limits.minWidth}×${limits.minHeight}px. Enviada: ${dims.width}×${dims.height}px.`,
          received: { width: dims.width, height: dims.height },
          minimum: { width: limits.minWidth, height: limits.minHeight },
        });
      }

      if (dims.width > limits.maxWidth || dims.height > limits.maxHeight) {
        return reply.code(422).send({
          code: ErrorCode.UPLOAD_INVALID_TYPE,
          error: `Imagem muito grande para "${folder}". Máximo: ${limits.maxWidth}×${limits.maxHeight}px. Enviada: ${dims.width}×${dims.height}px.`,
          received: { width: dims.width, height: dims.height },
          maximum: { width: limits.maxWidth, height: limits.maxHeight },
        });
      }
    }
    // Se parseDimensions retornar null (formato inesperado), o upload prossegue —
    // o Cloudinary fará sua própria validação e rejeitará arquivos inválidos.

    // ── Faz o upload ──
    try {
      const url = await uploadImage(buffer, folder, data.mimetype);
      request.uploadedFile = {
        path: url,
        mimetype: data.mimetype,
        fieldname: data.fieldname,
      };
    } catch (err: any) {
      throw new UploadError(ErrorCode.UPLOAD_CLOUDINARY_FAILED, {
        originalError: process.env.NODE_ENV !== 'production' ? err.message : undefined,
        hint: 'Verifique as variáveis CLOUDINARY_* no .env',
      });
    }
  };
}