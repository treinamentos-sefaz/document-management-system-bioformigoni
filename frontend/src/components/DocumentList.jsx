import DownloadButton from './DownloadButton.jsx';

function formatFileSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadDate(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default function DocumentList({ documents, loading, error, onDownloadError }) {
  if (loading) {
    return <p className="list-message" role="status">Carregando documentos...</p>;
  }

  if (error) {
    return <p className="list-message list-message-error" role="alert">{error}</p>;
  }

  if (documents.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state-mark" aria-hidden="true">—</span>
        <p>Nenhum documento por aqui.</p>
        <span>Os arquivos enviados aparecerão nesta lista.</span>
      </div>
    );
  }

  return (
    <>
      <div className="list-summary">
        <span>{documents.length} {documents.length === 1 ? 'documento' : 'documentos'}</span>
        <span>MAIS RECENTES</span>
      </div>
      <ul className="document-list">
        {documents.map((document) => (
          <li className="document-row" key={document.id}>
            <span className="document-mark" aria-hidden="true">DOC</span>
            <div className="document-details">
              <h3 title={document.originalName}>{document.originalName}</h3>
              <p>{formatUploadDate(document.uploadedAt)} <span aria-hidden="true">·</span> {formatFileSize(document.size)}</p>
            </div>
            <DownloadButton
              documentId={document.id}
              fileName={document.originalName}
              onError={onDownloadError}
            />
          </li>
        ))}
      </ul>
    </>
  );
}