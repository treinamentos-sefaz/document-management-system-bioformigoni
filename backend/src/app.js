const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('./config');
const { createDocumentRepository } = require('./repositories/documentRepository');
const { createDocumentService } = require('./services/documentService');
const { createDocumentController } = require('./controllers/documentController');
const { createDocumentRouter } = require('./routes/documentRoutes');

function createApp(options = {}) {
  const config = loadConfig();
  const storageDir = path.resolve(options.storageDir || config.storageDir);
  const maxFileSizeBytes = options.maxFileSizeBytes ?? config.maxFileSizeBytes;
  const resolveUser = options.resolveUser || ((req) => req.user?.id);

  if (!Number.isSafeInteger(maxFileSizeBytes) || maxFileSizeBytes <= 0) {
    throw new Error('DMS_MAX_FILE_SIZE_BYTES deve ser um inteiro positivo.');
  }

  fs.mkdirSync(storageDir, { recursive: true });

  const repository = createDocumentRepository({ storageDir });
  const service = createDocumentService({ repository });
  const controller = createDocumentController({ service });
  const app = express();

  app.use(express.json());
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(createDocumentRouter({
    controller,
    maxFileSizeBytes,
    resolveUser,
    storageDir,
  }));

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return res.end();
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'O arquivo excede o tamanho máximo permitido.',
        },
      });
    }

    if (error.name === 'MulterError') {
      return res.status(400).json({
        error: {
          code: 'INVALID_UPLOAD',
          message: 'O envio do arquivo é inválido.',
        },
      });
    }

    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    return res.status(statusCode).json({
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: statusCode === 500 ? 'Ocorreu um erro interno.' : error.message,
      },
    });
  });

  return app;
}

const app = createApp();
app.createApp = createApp;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`DMS backend ouvindo na porta ${PORT}`);
  });
}

module.exports = app;
