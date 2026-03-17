import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { createHttpError } from './logger.js';

const MIME_EXTENSION_MAP = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

export function ensureUploadDir(uploadDir) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function resolveExtension(file) {
  const originalExtension = path.extname(file.originalname || '').toLowerCase();
  if (MIME_EXTENSION_MAP.has(file.mimetype)) {
    return MIME_EXTENSION_MAP.get(file.mimetype);
  }

  if ([...MIME_EXTENSION_MAP.values()].includes(originalExtension)) {
    return originalExtension;
  }

  return '.bin';
}

export function createImageUploadMiddleware({ uploadDir, maxUploadMb = 5 }) {
  ensureUploadDir(uploadDir);

  const storage = multer.diskStorage({
    destination: (_request, _file, callback) => {
      callback(null, uploadDir);
    },
    filename: (_request, file, callback) => {
      callback(null, `${Date.now()}-${randomUUID()}${resolveExtension(file)}`);
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: Math.max(1, Number(maxUploadMb || 5)) * 1024 * 1024,
    },
    fileFilter: (_request, file, callback) => {
      if (!MIME_EXTENSION_MAP.has(file.mimetype)) {
        callback(createHttpError(400, 'Only JPG, PNG, GIF, and WebP images are supported.'));
        return;
      }

      callback(null, true);
    },
  }).single('image');
}

export function runImageUpload(uploadMiddleware, request, response) {
  return new Promise((resolve, reject) => {
    uploadMiddleware(request, response, (error) => {
      if (!error) {
        resolve(request.file || null);
        return;
      }

      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        reject(createHttpError(400, 'Image upload exceeded the maximum size limit.'));
        return;
      }

      if (error.statusCode) {
        reject(error);
        return;
      }

      reject(createHttpError(400, error.message || 'Unable to process the uploaded image.'));
    });
  });
}

export function buildUploadUrl(request, filename) {
  return `${request.protocol}://${request.get('host')}/uploads/${filename}`;
}
