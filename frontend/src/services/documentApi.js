const API_PREFIX = '/api';

async function getErrorMessage(response) {
  try {
    const body = await response.json();
    return body?.error?.message || `A solicitação falhou (${response.status}).`;
  } catch {
    return `A solicitação falhou (${response.status}).`;
  }
}

async function request(path, options) {
  let response;
  try {
    response = await fetch(`${API_PREFIX}${path}`, options);
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Verifique se o backend está em execução.');
  }

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return response;
}

export async function listDocuments() {
  const response = await request('/documents');
  const body = await response.json();
  return body.documents;
}

export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await request('/upload', {
    method: 'POST',
    body: formData,
  });

  return response.json();
}

export async function downloadDocument(documentId) {
  const response = await request(`/documents/${encodeURIComponent(documentId)}/download`);
  return response.blob();
}