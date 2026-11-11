function safeDownloadName(originalName, id) {
  const basename = String(originalName || '')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();

  return basename || `document-${id}`;
}

function createDocumentController({ service }) {
  return {
    async upload(req, res, next) {
      try {
        const document = await service.createDocument(req.file, req.documentOwnerId);
        return res.status(201).json(document);
      } catch (error) {
        return next(error);
      }
    },

    list(req, res, next) {
      try {
        const documents = service.listDocuments(req.documentOwnerId);
        return res.status(200).json({ documents });
      } catch (error) {
        return next(error);
      }
    },

    async download(req, res, next) {
      try {
        const result = await service.getDocumentDownload(req.params.id, req.documentOwnerId);
        return res.download(
          result.filePath,
          safeDownloadName(result.document.originalName, result.document.id),
          (error) => {
            if (error) {
              next(error);
            }
          },
        );
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = { createDocumentController };