// src/shared/plugins/upload.plugin.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { uploadImage, type UploadFolder } from '../services/cloudinary';
import { ValidationError, UploadError } from '../errors';
import { ErrorCode } from '../errors/error-codes';
import { validateImageMimetype } from '../validators';

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export function createUploadHandler(folder: UploadFolder) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    let data: Awaited<ReturnType<typeof request.file>>;

    try {
      data = await request.file({ limits: { fileSize: MAX_SIZE_BYTES } });
    } catch (err: any) {
      if (err.message === 'File size limit reached' || err.code === 'FST_FILES_LIMIT') {
        return reply.code(413).send({
          code:  ErrorCode.UPLOAD_TOO_LARGE,
          error: `O arquivo excede o limite de ${MAX_SIZE_BYTES / 1024 / 1024}MB.`,
          maxMb: 5,
        });
      }
      throw err;
    }

    if (!data) return; // sem arquivo — o handler decide se é obrigatório

    // Valida tipo MIME
    if (!ACCEPTED_TYPES.includes(data.mimetype.toLowerCase())) {
      // drena o stream para evitar memory leak
      data.file.resume();
      return reply.code(415).send({
        code:     ErrorCode.UPLOAD_INVALID_TYPE,
        error:    'Tipo de arquivo não suportado. Envie apenas imagens JPEG, PNG ou WebP.',
        received: data.mimetype,
        accepted: ACCEPTED_TYPES,
      });
    }

    try {
      const buffer = await data.toBuffer();

      // double-check de tamanho após o buffer
      if (buffer.length > MAX_SIZE_BYTES) {
        return reply.code(413).send({
          code:    ErrorCode.UPLOAD_TOO_LARGE,
          error:   `O arquivo tem ${(buffer.length / 1024 / 1024).toFixed(2)}MB. Máximo permitido: 5MB.`,
          maxMb:   5,
          sizeMb:  +(buffer.length / 1024 / 1024).toFixed(2),
        });
      }

      const url = await uploadImage(buffer, folder, data.mimetype);
      request.uploadedFile = {
        path:      url,
        mimetype:  data.mimetype,
        fieldname: data.fieldname,
      };
    } catch (err: any) {
      throw new UploadError(ErrorCode.UPLOAD_CLOUDINARY_FAILED, {
        originalError: err.message,
        hint: 'Verifique as variáveis CLOUDINARY_* no .env',
      });
    }
  };
}
