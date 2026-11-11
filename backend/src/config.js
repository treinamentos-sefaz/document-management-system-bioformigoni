const path = require('node:path');

function loadConfig() {
  const projectRoot = path.resolve(__dirname, '../..');
  const storageDir = path.resolve(
    projectRoot,
    process.env.DMS_STORAGE_DIR || 'backend/storage',
  );
  const maxFileSizeBytes = process.env.DMS_MAX_FILE_SIZE_BYTES === undefined
    ? 10 * 1024 * 1024
    : Number(process.env.DMS_MAX_FILE_SIZE_BYTES);

  if (!Number.isSafeInteger(maxFileSizeBytes) || maxFileSizeBytes <= 0) {
    throw new Error('DMS_MAX_FILE_SIZE_BYTES deve ser um inteiro positivo.');
  }

  return { maxFileSizeBytes, storageDir };
}

module.exports = { loadConfig };