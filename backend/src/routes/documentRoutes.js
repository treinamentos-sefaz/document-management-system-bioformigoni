const { randomUUID } = require('node:crypto');
const express = require('express');
const multer = require('multer');

function createDocumentRouter({ controller, maxFileSizeBytes, resolveUser, storageDir }) {
  const router = express.Router();
  const upload = multer({
    storage: multer.diskStorage({
      destination: storageDir,
      filename: (req, file, callback) => callback(null, randomUUID()),
    }),
    limits: {
      fileSize: maxFileSizeBytes,
      files: 1,
    },
  });

  const requireUser = (req, res, next) => {
    let userId;

    try {
      userId = resolveUser(req);
    } catch (error) {
      return next(error);
    }

    if (typeof userId !== 'string' || userId.trim() === '') {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'É necessário identificar o usuário.',
        },
      });
    }

    req.documentOwnerId = userId;
    return next();
  };

  router.post('/upload', requireUser, upload.single('file'), controller.upload);
  router.get('/documents', requireUser, controller.list);
  router.get('/documents/:id/download', requireUser, controller.download);

  return router;
}

module.exports = { createDocumentRouter };