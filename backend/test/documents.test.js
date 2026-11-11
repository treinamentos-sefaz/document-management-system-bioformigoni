const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const appModule = require('../src/app');
const { loadConfig } = require('../src/config');

const createApp = appModule.createApp;

async function startTestServer(t, options = {}) {
  const storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dms-test-'));
  const app = createApp({
    storageDir,
    resolveUser: (req) => req.get('x-test-user'),
    ...options,
  });
  const server = app.listen(0);

  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await fs.rm(storageDir, { recursive: true, force: true });
  });

  return `http://127.0.0.1:${server.address().port}`;
}

function fileForm(contents, filename = 'sample.txt') {
  const form = new FormData();
  form.append('file', new Blob([contents], { type: 'text/plain' }), filename);
  return form;
}

test('upload, listagem e download ficam associados ao usuário', async (t) => {
  const baseUrl = await startTestServer(t);
  const uploadResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'x-test-user': 'alice' },
    body: fileForm('conteudo do documento'),
  });

  assert.equal(uploadResponse.status, 201);
  const document = await uploadResponse.json();
  assert.deepEqual(Object.keys(document).sort(), ['id', 'originalName', 'size', 'uploadedAt']);
  assert.equal(document.originalName, 'sample.txt');
  assert.equal(document.size, Buffer.byteLength('conteudo do documento'));

  const listResponse = await fetch(`${baseUrl}/documents`, {
    headers: { 'x-test-user': 'alice' },
  });
  assert.equal(listResponse.status, 200);
  assert.deepEqual((await listResponse.json()).documents, [document]);

  const otherUserDownload = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: { 'x-test-user': 'bob' },
  });
  assert.equal(otherUserDownload.status, 404);

  const downloadResponse = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: { 'x-test-user': 'alice' },
  });
  assert.equal(downloadResponse.status, 200);
  assert.equal(await downloadResponse.text(), 'conteudo do documento');

  const unauthenticatedResponse = await fetch(`${baseUrl}/documents`);
  assert.equal(unauthenticatedResponse.status, 401);
});

test('upload rejeita ausência de arquivo e excedente de tamanho', async (t) => {
  const baseUrl = await startTestServer(t, { maxFileSizeBytes: 4 });
  const emptyFileResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'x-test-user': 'alice' },
    body: fileForm(''),
  });
  assert.equal(emptyFileResponse.status, 400);
  assert.equal((await emptyFileResponse.json()).error.code, 'EMPTY_FILE');

  const missingFileResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'x-test-user': 'alice' },
    body: new FormData(),
  });
  assert.equal(missingFileResponse.status, 400);

  const oversizedResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'x-test-user': 'alice' },
    body: fileForm('conteudo maior que quatro bytes'),
  });
  assert.equal(oversizedResponse.status, 413);
  assert.equal((await oversizedResponse.json()).error.code, 'FILE_TOO_LARGE');
});

test('usa o usuário local configurado quando não há middleware de autenticação', async (t) => {
  const baseUrl = await startTestServer(t, {
    localUserId: 'local-test-user',
    resolveUser: null,
  });
  const response = await fetch(`${baseUrl}/documents`);

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).documents, []);
});

test('não habilita identidade local estática em produção', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousLocalUserId = process.env.DMS_LOCAL_USER_ID;
  process.env.NODE_ENV = 'production';
  process.env.DMS_LOCAL_USER_ID = 'shared-production-user';

  try {
    assert.equal(loadConfig().localUserId, '');
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }

    if (previousLocalUserId === undefined) {
      delete process.env.DMS_LOCAL_USER_ID;
    } else {
      process.env.DMS_LOCAL_USER_ID = previousLocalUserId;
    }
  }
});