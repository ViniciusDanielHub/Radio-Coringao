// src/shared/plugins/upload.plugin.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { uploadImage, type UploadFolder } from '../services/cloudinary';
import { AppError } from '../errors';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export function createUploadHandler(folder: UploadFolder) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const data = await request.file({ limits: { fileSize: MAX_SIZE } });
    if (!data) return; // no file — caller decides if required

    if (!data.mimetype.startsWith('image/')) {
      reply.code(400).send({ error: 'Apenas imagens são permitidas.' });
      return;
    }

    try {
      const buffer = await data.toBuffer();
      const url = await uploadImage(buffer, folder, data.mimetype);
      request.uploadedFile = { path: url, mimetype: data.mimetype, fieldname: data.fieldname };
    } catch (err: any) {
      reply.code(500).send({ error: 'Erro ao fazer upload da imagem.' });
    }
  };
}
