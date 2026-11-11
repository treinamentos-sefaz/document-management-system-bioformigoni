const { randomUUID } = require('node:crypto');

function createDocumentError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function toPublicDocument(document) {
  return {
    id: document.id,
    originalName: document.originalName,
    size: document.size,
    uploadedAt: document.uploadedAt,
  };
}

function createDocumentService({ repository }) {
  return {
    async createDocument(file, owner) {
      if (!file) {
        throw createDocumentError(400, 'FILE_REQUIRED', 'Envie um arquivo no campo file.');
      }

      if (file.size === 0) {
        await repository.removeStoredFile(file.filename);
        throw createDocumentError(400, 'EMPTY_FILE', 'O arquivo não pode estar vazio.');
      }

      if (typeof owner !== 'string' || owner.trim() === '') {
        await repository.removeStoredFile(file.filename);
        throw createDocumentError(401, 'UNAUTHENTICATED', 'É necessário identificar o usuário.');
      }

      const document = {
        id: randomUUID(),
        originalName: file.originalname,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        owner,
        storageName: file.filename,
      };

      try {
        repository.create(document);
      } catch (error) {
        try {
          await repository.removeStoredFile(file.filename);
        } catch (cleanupError) {
          console.error('Não foi possível remover o arquivo após falha no registro.', cleanupError);
        }

        throw error;
      }

      return toPublicDocument(document);
    },

    listDocuments(owner) {
      if (typeof owner !== 'string' || owner.trim() === '') {
        throw createDocumentError(401, 'UNAUTHENTICATED', 'É necessário identificar o usuário.');
      }

      return repository.listByOwner(owner).map(toPublicDocument);
    },

    async getDocumentDownload(id, owner) {
      if (typeof owner !== 'string' || owner.trim() === '') {
        throw createDocumentError(401, 'UNAUTHENTICATED', 'É necessário identificar o usuário.');
      }

      const document = repository.findById(id);
      if (!document || document.owner !== owner) {
        throw createDocumentError(404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
      }

      if (!await repository.isFileAvailable(document.storageName)) {
        throw createDocumentError(404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
      }

      return {
        document: toPublicDocument(document),
        filePath: repository.getFilePath(document.storageName),
      };
    },
  };
}

module.exports = { createDocumentService };