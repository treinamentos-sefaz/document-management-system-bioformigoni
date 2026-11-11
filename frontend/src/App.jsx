import { useEffect, useState } from 'react';
import DocumentList from './components/DocumentList.jsx';
import UploadComponent from './components/UploadComponent.jsx';
import { listDocuments, uploadDocument } from './services/documentApi.js';
import './App.css';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    setIsLoading(true);
    setListError('');

    listDocuments()
      .then((result) => {
        if (isCurrent) {
          setDocuments(result);
        }
      })
      .catch((requestError) => {
        if (isCurrent) {
          setListError(requestError.message);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [refreshKey]);

  async function handleUpload(file) {
    setIsUploading(true);
    setError('');
    setNotice('');

    try {
      const document = await uploadDocument(file);
      setDocuments((currentDocuments) => [
        document,
        ...currentDocuments.filter((item) => item.id !== document.id),
      ]);
      setListError('');
      setNotice('Documento enviado.');
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="DMS, início">
          <span className="brand-mark" aria-hidden="true">D</span>
          <span>DMS<span className="brand-period">.</span></span>
        </a>
        <div className="system-status">
          <span className="status-dot" aria-hidden="true" />
          <span>ARQUIVOS LOCAIS</span>
        </div>
      </header>

      <section className="page-heading" id="inicio">
        <div>
          <p className="eyebrow">ESPAÇO DE TRABALHO / DOCUMENTOS</p>
          <h1>Seus documentos<span className="heading-period">.</span></h1>
        </div>
        <p className="heading-note">Organizados em um só lugar.</p>
      </section>

      {(error || notice) && (
        <div className={`feedback-banner ${error ? 'feedback-error' : 'feedback-success'}`}>
          <span role={error ? 'alert' : 'status'}>{error || notice}</span>
          <button
            className="feedback-dismiss"
            type="button"
            aria-label="Fechar mensagem"
            onClick={() => {
              setError('');
              setNotice('');
            }}
          >
            ×
          </button>
        </div>
      )}

      <div className="workspace-grid">
        <aside className="upload-section">
          <div className="section-heading">
            <p className="eyebrow">ADICIONAR</p>
            <h2>Novo documento</h2>
          </div>
          <UploadComponent onUpload={handleUpload} uploading={isUploading} />
          <div className="local-note">
            <span className="local-note-icon" aria-hidden="true">↳</span>
            <p>Armazenamento local<br />Metadados temporários</p>
          </div>
        </aside>

        <section className="library-section" aria-labelledby="library-title">
          <div className="library-heading">
            <div className="section-heading">
              <p className="eyebrow">BIBLIOTECA</p>
              <h2 id="library-title">Documentos enviados</h2>
            </div>
            <button
              className="refresh-button"
              type="button"
              onClick={() => setRefreshKey((currentKey) => currentKey + 1)}
              disabled={isLoading}
              title="Atualizar lista"
            >
              <span aria-hidden="true">↻</span>
              <span>Atualizar</span>
            </button>
          </div>
          <DocumentList
            documents={documents}
            loading={isLoading}
            error={listError}
            onDownloadError={setError}
          />
        </section>
      </div>

      <footer className="page-footer">
        <span>DMS <span className="brand-period">/</span> GESTÃO DE DOCUMENTOS</span>
        <span>METADADOS EM MEMÓRIA</span>
      </footer>
    </main>
  );
}
