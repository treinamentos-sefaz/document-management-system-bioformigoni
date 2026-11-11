const fs = require('node:fs/promises');
const path = require('node:path');

function createDocumentRepository({ storageDir }) {
  const documents = new Map();

  return {
    create(document) {
      if (documents.has(document.id)) {
        throw new Error('O identificador do documento já existe.');
      }

      documents.set(document.id, { ...document });
      return { ...document };
    },

    listByOwner(owner) {
      return [...documents.values()]
        .filter((document) => document.owner === owner)
        .sort((left, right) => {
          const dateOrder = right.uploadedAt.localeCompare(left.uploadedAt);
          return dateOrder || left.id.localeCompare(right.id);
        })
        .map((document) => ({ ...document }));
    },

    findById(id) {
      const document = documents.get(id);
      return document ? { ...document } : null;
    },

    getFilePath(storageName) {
      if (!storageName || path.basename(storageName) !== storageName) {
        throw new Error('Nome de armazenamento inválido.');
      }

      return path.join(storageDir, storageName);
    },

    async isFileAvailable(storageName) {
      const filePath = this.getFilePath(storageName);

      try {
        await fs.access(filePath);
        return true;
      } catch (error) {
        if (error.code === 'ENOENT') {
          return false;
        }

        throw error;
      }
    },

    async removeStoredFile(storageName) {
      await fs.unlink(this.getFilePath(storageName));
    },
  };
}

module.exports = { createDocumentRepository };