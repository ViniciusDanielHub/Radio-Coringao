import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { logger } from '../../logger';                    // ← logger estruturado

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export type UploadFolder = 'articles' | 'avatars' | 'banners' | 'events' | 'sponsors';

const TRANSFORMATIONS: Record<UploadFolder, object[]> = {
  articles: [{ width: 1200, height: 675, crop: 'fill', quality: 'auto', fetch_format: 'auto' }],
  avatars: [{ width: 200, height: 200, crop: 'fill', quality: 'auto', fetch_format: 'auto' }],
  banners: [{ width: 1920, height: 600, crop: 'fill', quality: 'auto', fetch_format: 'auto' }],
  events: [{ width: 1200, height: 675, crop: 'fill', quality: 'auto', fetch_format: 'auto' }],
  sponsors: [{ width: 400, height: 400, crop: 'pad', quality: 'auto', fetch_format: 'auto' }],
};

// ─── Extrai o public_id do Cloudinary a partir da URL ─────────
// Ex: https://res.cloudinary.com/meu-cloud/image/upload/v123/sports-news/articles/abc.webp
//  → sports-news/articles/abc
function extractPublicId(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl);
    // O path tem formato: /image/upload/v<version>/<folder>/<filename>.<ext>
    // ou sem versão:       /image/upload/<folder>/<filename>.<ext>
    const parts = url.pathname.split('/');
    const uploadIdx = parts.indexOf('upload');
    if (uploadIdx === -1) return null;

    // Pula o segmento de versão (começa com "v" seguido de dígitos) se existir
    let startIdx = uploadIdx + 1;
    if (/^v\d+$/.test(parts[startIdx] ?? '')) startIdx++;

    const remaining = parts.slice(startIdx).join('/');
    // Remove a extensão
    return remaining.replace(/\.[^/.]+$/, '') || null;
  } catch {
    return null;
  }
}

// ─── Upload ───────────────────────────────────────────────────
export async function uploadImage(
  buffer: Buffer,
  folder: UploadFolder,
  mimeType: string,
): Promise<string> {
  const baseFolder = process.env.CLOUDINARY_FOLDER || 'sports-news';

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${baseFolder}/${folder}`,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: TRANSFORMATIONS[folder],
        resource_type: 'image',
      },
      (error, result) => {
        if (error || !result) {
          logger.error(
            { err: error, folder, mimeType },
            'Falha ao fazer upload da imagem no Cloudinary',
          );
          return reject(error ?? new Error('Upload falhou sem erro detalhado.'));
        }
        logger.debug({ publicId: result.public_id, folder }, 'Imagem enviada ao Cloudinary');
        resolve(result.secure_url);
      },
    );

    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(stream);
  });
}

// ─── Deleção com erro propagado ───────────────────────────────
//
// IMPORTANTE: esta função RELANÇA erros. Chamadores que precisam ignorar
// falhas de deleção devem usar deleteImageSafe() abaixo.
//
// Por que relanças e não engolir?
//   - Arquivos órfãos no Cloudinary custam dinheiro e espaço.
//   - Se a deleção falha sistematicamente, precisa ser investigado.
//   - O chamador tem contexto suficiente para decidir como tratar.
export async function deleteImage(imageUrl: string | null | undefined): Promise<void> {
  if (!imageUrl) return;

  const publicId = extractPublicId(imageUrl);
  if (!publicId) {
    logger.warn({ imageUrl }, 'Não foi possível extrair o public_id do Cloudinary da URL');
    return;
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    if (result.result !== 'ok' && result.result !== 'not found') {
      // "not found" é aceitável — a imagem pode já ter sido deletada manualmente
      logger.warn({ publicId, result: result.result }, 'Cloudinary retornou resultado inesperado na deleção');
    } else {
      logger.debug({ publicId, result: result.result }, 'Imagem removida do Cloudinary');
    }
  } catch (err: any) {
    logger.error({ err, publicId, imageUrl }, 'Erro ao deletar imagem do Cloudinary');
    throw err;   // ← relança para o chamador decidir
  }
}

// ─── Deleção silenciosa (fire-and-forget seguro) ──────────────
//
// Use quando a operação principal (ex: update de artigo) NÃO deve falhar
// por causa da deleção da imagem antiga. O erro ainda é logado de forma
// estruturada — apenas não é propagado.
export async function deleteImageSafe(
  imageUrl: string | null | undefined,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    await deleteImage(imageUrl);
  } catch (err: any) {
    logger.warn(
      { err, imageUrl, ...context },
      'Falha ao deletar imagem antiga (operação principal não foi afetada)',
    );
    // não relança — intencionalmente silencioso no chamador
  }
}