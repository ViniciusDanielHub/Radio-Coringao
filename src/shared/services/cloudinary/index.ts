// src/shared/services/cloudinary/index.ts
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export type UploadFolder = 'articles' | 'avatars' | 'banners';

const TRANSFORMATIONS: Record<UploadFolder, object[]> = {
  articles: [{ width: 1200, height: 675, crop: 'fill', quality: 'auto', fetch_format: 'auto' }],
  avatars: [{ width: 200, height: 200, crop: 'fill', quality: 'auto', fetch_format: 'auto' }],
  banners: [{ width: 1920, height: 600, crop: 'fill', quality: 'auto', fetch_format: 'auto' }],
};

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
        if (error || !result) return reject(error || new Error('Upload falhou.'));
        resolve(result.secure_url);
      },
    );

    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(stream);
  });
}

export async function deleteImage(imageUrl: string | null | undefined): Promise<void> {
  if (!imageUrl) return;
  try {
    const parts = imageUrl.split('/');
    const filename = parts[parts.length - 1].split('.')[0];
    const folder = parts.slice(-3, -1).join('/');
    const publicId = `${folder}/${filename}`;
    await cloudinary.uploader.destroy(publicId);
  } catch (err: any) {
    console.error('Erro ao deletar imagem do Cloudinary:', err.message);
  }
}
