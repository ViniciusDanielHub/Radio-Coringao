// src/shared/plugins/upload.plugin.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { uploadImage, type UploadFolder } from '../services/cloudinary';
import { UploadError } from '../errors';
import { ErrorCode } from '../errors/error-codes';

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// ─── Assinaturas de magic bytes para validação real do arquivo ─
const MAGIC_BYTES: { signature: number[]; type: string }[] = [
  { signature: [0xFF, 0xD8, 0xFF], type: 'image/jpeg' },
  { signature: [0x89, 0x50, 0x4E, 0x47], type: 'image/png' },
  { signature: [0x52, 0x49, 0x46, 0x46], type: 'image/webp' }, // RIFF....WEBP
];

function detectMimeFromBuffer(buf: Buffer): string | null {
  for (const { signature, type } of MAGIC_BYTES) {
    if (signature.every((byte, i) => buf[i] === byte)) {
      // WebP exige confirmação adicional nos bytes 8-11
      if (type === 'image/webp') {
        const webpMarker = buf.slice(8, 12).toString('ascii');
        if (webpMarker !== 'WEBP') continue;
      }
      return type;
    }
  }
  return null;
}

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

    // Sem arquivo — o handler decide se é obrigatório
    if (!data) return;

    // ── Valida tipo MIME declarado ──
    const declaredMime = data.mimetype?.toLowerCase() ?? '';
    if (!ACCEPTED_TYPES.includes(declaredMime)) {
      data.file.resume(); // drena para evitar memory leak
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
    } catch (bufErr: any) {
      return reply.code(400).send({
        code: ErrorCode.UPLOAD_CORRUPTED_FILE,
        error: 'Não foi possível ler o arquivo enviado. Tente novamente.',
      });
    }

    // ── Valida arquivo vazio ──
    if (!buffer || buffer.length === 0) {
      return reply.code(400).send({
        code: ErrorCode.UPLOAD_EMPTY_FILE,
        error: 'O arquivo enviado está vazio.',
      });
    }

    // ── Double-check de tamanho após buffer ──
    if (buffer.length > MAX_SIZE_BYTES) {
      return reply.code(413).send({
        code: ErrorCode.UPLOAD_TOO_LARGE,
        error: `O arquivo tem ${(buffer.length / 1024 / 1024).toFixed(2)}MB. Máximo permitido: 5MB.`,
        maxMb: 5,
        sizeMb: +(buffer.length / 1024 / 1024).toFixed(2),
      });
    }

    // ── Valida magic bytes (tipo real do arquivo) ──
    const realMime = detectMimeFromBuffer(buffer);
    if (!realMime) {
      return reply.code(415).send({
        code: ErrorCode.UPLOAD_CORRUPTED_FILE,
        error: 'O arquivo enviado não é uma imagem válida (verificação de conteúdo falhou).',
      });
    }
    // Normaliza jpeg
    const normalizedDeclared = declaredMime === 'image/jpg' ? 'image/jpeg' : declaredMime;
    if (realMime !== normalizedDeclared) {
      return reply.code(415).send({
        code: ErrorCode.UPLOAD_INVALID_TYPE,
        error: 'O conteúdo do arquivo não corresponde ao tipo declarado.',
        declared: declaredMime,
        detected: realMime,
      });
    }

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