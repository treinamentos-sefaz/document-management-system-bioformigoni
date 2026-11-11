# Especificação - Document Management System

## 1. Objetivo

Disponibilizar uma aplicação web simples para que usuários enviem, listem e baixem seus documentos, mantendo os arquivos no filesystem local e os metadados em memória.

## 2. Escopo

### Dentro do escopo

- Envio de um documento por requisição.
- Listagem dos documentos do usuário identificado na requisição.
- Download de um documento pelo identificador.
- Associação de cada documento a um usuário.
- Interface web React para envio, listagem e download.
- Verificação de saúde do backend.

### Fora do escopo

- Armazenamento externo, em nuvem ou em banco de dados.
- Persistência durável dos metadados.
- Versionamento, edição, compartilhamento ou exclusão de documentos.
- Cadastro de usuários, recuperação de senha e administração de contas.
- Autenticação completa e autorização baseada em papéis; a origem confiável da identidade do usuário é uma decisão pendente, descrita na seção 7.

## 3. Requisitos funcionais

| ID | Requisito | Critério de aceite |
| --- | --- | --- |
| RF-01 | O usuário pode enviar um documento por `multipart/form-data`, no campo `file`. | Uma requisição válida retorna `201 Created` e os metadados públicos do documento criado. |
| RF-02 | O sistema valida que um arquivo foi enviado e que não está vazio. | Ausência ou tamanho zero resulta em `400 Bad Request`, sem registro de documento. |
| RF-03 | O sistema grava o conteúdo do arquivo no filesystem local. | O arquivo fica em `backend/storage` por padrão, com nome de armazenamento gerado pelo servidor. |
| RF-04 | O sistema registra os metadados do documento em memória e associa o registro ao usuário atual. | O registro pode ser recuperado enquanto o processo estiver em execução e contém um `owner` confiável. |
| RF-05 | O usuário pode listar seus documentos. | `GET /documents` retorna somente documentos pertencentes ao usuário atual, em ordem decrescente de `uploadedAt`. |
| RF-06 | O usuário pode baixar um documento pelo identificador. | O download retorna os bytes do arquivo e usa o nome original, tratado com segurança, como nome de anexo. |
| RF-07 | O sistema não revela se um identificador existente pertence a outro usuário. | Documento inexistente ou de outro usuário resulta na mesma resposta `404 Not Found`. |
| RF-08 | O usuário recebe mensagens de erro consistentes quando uma operação falha. | Erros da API seguem o formato definido na seção 6 e não expõem caminhos locais nem stack traces. |
| RF-09 | O sistema expõe uma verificação de saúde do backend. | `GET /health` retorna `200 OK` e `{ "status": "ok" }` quando a aplicação está disponível. |
| RF-10 | A interface permite enviar, consultar e baixar documentos por meio da API. | As ações exibem estados de carregamento e erros retornados pela API, sem declarar sucesso antes da confirmação do servidor. |

## 4. Requisitos não funcionais

| ID | Requisito | Critério de aceite |
| --- | --- | --- |
| RNF-01 | Os arquivos são recebidos por Multer configurado com `diskStorage`. | Nenhum provedor de upload ou armazenamento externo é usado. |
| RNF-02 | O diretório local padrão é `backend/storage`. | O diretório é criado quando necessário; falha de acesso é tratada como erro, sem sucesso falso. |
| RNF-03 | Os metadados são mantidos em memória nesta fase. | Ao reiniciar o backend, os registros não são recuperados; não se presume persistência de metadados. |
| RNF-04 | O tamanho máximo padrão de upload é 10 MiB e pode ser configurado por ambiente. | Arquivos acima do limite retornam `413 Payload Too Large`; a configuração inválida impede a inicialização ou usa o valor padrão documentado, sem ignorar silenciosamente o limite. |
| RNF-05 | A configuração operacional é feita por variáveis de ambiente. | A porta usa `PORT` (padrão `3000`); o limite usa `DMS_MAX_FILE_SIZE_BYTES` (padrão `10485760`); o diretório usa `DMS_STORAGE_DIR` (padrão `backend/storage`); o usuário local usa `DMS_LOCAL_USER_ID` (padrão `local-user` fora de produção). O diretório configurado deve ser local. |
| RNF-06 | Nomes de arquivo fornecidos pelo usuário não determinam o caminho de gravação. | O nome físico é gerado pelo servidor; caminhos e nomes são tratados contra traversal e injeção em cabeçalhos. |
| RNF-07 | A API é acessada pelo frontend com prefixo `/api` em desenvolvimento. | O proxy do Vite remove `/api` e encaminha as chamadas ao backend local. |
| RNF-08 | O backend mantém responsabilidades separadas. | Rotas delegam a controllers, controllers a services e services a repositories; camadas internas não dependem de Express. |

### Limites e tipos de arquivo

O MVP aceita qualquer tipo de arquivo não vazio até o limite configurado. A extensão e o `Content-Type` enviados pelo cliente não são considerados prova do conteúdo real. Não há lista de tipos permitidos nesta versão. O limite padrão de 10 MiB é uma decisão inicial configurável, não uma garantia de limite universal para todos os ambientes.

## 5. Modelo de dados

### Metadados do documento

| Campo | Tipo | Exposição | Descrição |
| --- | --- | --- | --- |
| `id` | string | Público | Identificador opaco e único, gerado pelo servidor (UUID recomendado). |
| `originalName` | string | Público | Nome original fornecido no upload, preservado como metadado e sanitizado ao compor o nome de download. |
| `size` | number | Público | Tamanho do arquivo em bytes. |
| `uploadedAt` | string | Público | Data e hora do upload em ISO 8601, preferencialmente UTC. |
| `owner` | string | Interno | Identificador do usuário obtido de contexto confiável do servidor; não é definido pelo corpo do upload nem por parâmetro de consulta. |
| `storageName` | string | Interno | Nome/caminho relativo gerado pelo servidor para localizar o arquivo no diretório local. Nunca é retornado pela API. |

O contrato de resposta pública contém `id`, `originalName`, `size` e `uploadedAt`; não inclui `owner` nem `storageName`. O `owner` é usado para filtrar listagens e autorizar downloads. A estrutura interna não precisa expor detalhes de Multer para as camadas de serviço ou para a API.

### Regras de ciclo de vida

- Metadados são adicionados após a gravação local bem-sucedida.
- Se o registro em memória falhar após a gravação, o arquivo recém-gravado deve ser removido quando possível.
- Uma reinicialização perde os metadados. Arquivos remanescentes sem metadados podem existir; reconciliação e limpeza automática não fazem parte do MVP.
- A aplicação não oferece operação de exclusão nesta versão.

## 6. Contratos de API

Todas as respostas JSON usam `Content-Type: application/json; charset=utf-8`, salvo downloads. As rotas abaixo são caminhos do backend; no frontend de desenvolvimento são chamadas com o prefixo `/api`.

### Formato de erro

```json
{
  "error": {
    "code": "FILE_REQUIRED",
    "message": "Envie um arquivo no campo file."
  }
}
```

`code` é estável para tratamento pelo cliente. `message` é uma mensagem segura para apresentação. Erros inesperados retornam `500 Internal Server Error` sem detalhes internos.

### `POST /upload`

- **Entrada:** `multipart/form-data` com exatamente um arquivo no campo `file`.
- **Sucesso:** `201 Created`; corpo com os metadados públicos do documento.

```json
{
  "id": "4f0e2e81-ec38-4a2f-9f48-460237bb3c71",
  "originalName": "relatorio.pdf",
  "size": 2048,
  "uploadedAt": "2026-11-11T12:00:00.000Z"
}
```

- **Erros:** `400 Bad Request` para campo ausente, arquivo vazio ou entrada inválida; `413 Payload Too Large` acima do limite; `500 Internal Server Error` para falha inesperada de gravação ou processamento.
- Arquivos adicionais ou campos de arquivo inesperados são rejeitados como entrada inválida.

### `GET /documents`

- **Entrada:** sem corpo. O escopo é o usuário atual; não aceita parâmetro para escolher outro `owner`.
- **Sucesso:** `200 OK`; JSON `{ "documents": [...] }`, incluindo apenas os metadados públicos do usuário atual. Lista vazia retorna `200` com array vazio.
- A ordenação é por `uploadedAt` decrescente; em empate, a implementação deve manter resultado determinístico.
- **Erros:** `500 Internal Server Error` para falha inesperada.

### `GET /documents/:id/download`

- **Entrada:** `id` opaco na rota.
- **Sucesso:** `200 OK`, bytes do arquivo, `Content-Type` determinado com segurança ou `application/octet-stream` como fallback, e `Content-Disposition: attachment` com nome original sanitizado.
- **Erros:** `400 Bad Request` para identificador malformado quando a validação for aplicável; `404 Not Found` para documento inexistente, de outro usuário ou cujo arquivo não esteja disponível. Erros de leitura inesperados retornam `500 Internal Server Error`.
- O identificador não deve permitir escolher caminhos no filesystem. A resposta não revela caminhos locais.

### `GET /health`

- **Sucesso:** `200 OK` com `{ "status": "ok" }`.
- Endpoint operacional existente no seed; não expõe configuração, diretórios ou detalhes de infraestrutura.

### Identidade e autorização

As operações de usuário dependem de um identificador obtido de contexto confiável do servidor. Em execução local fora de produção, se não houver middleware de autenticação, o servidor usa a identidade única `DMS_LOCAL_USER_ID` (padrão `local-user`); todos os acessos locais pertencem a esse mesmo usuário. Esse modo é conveniência para desenvolvimento, não autenticação nem isolamento entre usuários. Em produção, a aplicação exige um `req.user.id` fornecido por middleware confiável; se ausente, retorna `401 Unauthorized`. A API não deve confiar em `owner` fornecido no corpo, query string ou cabeçalho arbitrário do cliente.

## 7. Decisões arquiteturais

- **Backend:** Node.js, Express e CommonJS, organizado em `routes/`, `controllers/`, `services/` e `repositories/`, com fluxo de dependência `routes -> controllers -> services -> repositories`.
- **Upload:** Multer com `diskStorage`; destino padrão `backend/storage`. O nome físico é gerado no servidor e não deriva diretamente do nome original.
- **Persistência:** arquivos no filesystem local; metadados em memória nesta fase. Não introduzir banco de dados, storage externo ou serviço de upload de terceiros.
- **Frontend:** React com componentes funcionais e Hooks; chamadas HTTP via `fetch` pelo prefixo `/api` configurado no proxy do Vite.
- **Configuração:** variáveis de ambiente conforme RNF-05; valores devem ser validados na inicialização.
- **Tratamento HTTP:** controllers validam a fronteira HTTP e convertem resultados/erros em respostas; regras de negócio permanecem nos services; repositórios encapsulam filesystem e metadados.
- **Falhas parciais:** falha na criação de metadados após gravação deve tentar remover o arquivo, evitando órfão novo quando possível. Falhas de remoção são registradas sem expor dados internos ao cliente.

### Riscos e decisões pendentes

1. **Identidade do usuário:** o modo local usa uma identidade única configurável; antes de produção ou uso multiusuário, integrar autenticação que forneça contexto confiável. Não usar um identificador livre enviado pelo cliente como mecanismo de autenticação.
2. **Perda de metadados:** reiniciar o processo torna os documentos gravados indisponíveis pela API, embora os arquivos possam continuar no disco. Isso é consequência aceita da fase inicial.
3. **Arquivos órfãos:** quedas entre a gravação e o registro em memória podem deixar arquivos sem metadados. Reconciliação posterior não faz parte deste escopo.
4. **Limite de tamanho:** 10 MiB é o padrão proposto e deve ser ajustado por ambiente. O produto pode precisar rever esse limite ou estabelecer tipos aceitos.
5. **Concorrência e escala:** o estado em memória é local a um processo; múltiplas instâncias não compartilham metadados e estão fora dos pressupostos do MVP.

## 8. Plano de execução

Este roteiro organiza a implementação por capacidades. Não especifica alterações por arquivo nem executa trabalho de backend ou frontend nesta etapa.

1. **Definir identidade do usuário.** Escolher a origem confiável do contexto de usuário e confirmar a regra de isolamento. **Aceite:** decisões documentadas; nenhuma rota usa `owner` controlado pelo cliente como autoridade.
2. **Preparar o backend e o armazenamento local.** Validar configuração, garantir o diretório local e estabelecer tratamento de erros. **Aceite:** servidor inicializa com configuração padrão e falha de forma explícita se o armazenamento não puder ser usado.
3. **Implementar o envio e o registro.** Receber arquivo com Multer `diskStorage`, aplicar validações e criar metadados em memória. **Aceite:** upload válido retorna `201`; entradas inválidas e excesso de tamanho retornam erros definidos; falhas parciais tentam limpar o arquivo.
4. **Implementar listagem e download.** Aplicar escopo do usuário, ordenação e entrega segura do arquivo. **Aceite:** usuário só lista e baixa seus próprios documentos; IDs de terceiros e inexistentes não são distinguidos.
5. **Implementar a experiência web.** Permitir envio, exibição da lista, estados vazios/carregamento/erro e download via API. **Aceite:** interface reflete os resultados reais do servidor e permanece utilizável após falhas de rede ou validação.
6. **Validar contratos e comportamento integrado.** Cobrir respostas de sucesso, erros, isolamento por usuário, limites de upload e fluxo frontend/backend. **Aceite:** testes relevantes passam; `/health` permanece disponível; nenhuma dependência de armazenamento externo foi introduzida.

## 9. Critérios de aceite do produto

- Um usuário com contexto confiável consegue enviar um arquivo válido dentro do limite e recebe seus metadados públicos.
- A listagem mostra somente documentos do usuário atual e funciona sem resultados.
- O download retorna o conteúdo original e não permite acesso por caminho arbitrário.
- Arquivos ficam no armazenamento local; metadados permanecem em memória e a perda após reinício está documentada.
- Erros de validação, tamanho, ausência e falha interna têm respostas previsíveis e seguras.
- A interface consome a API pelo proxy `/api` e apresenta sucesso ou falha com base na resposta do backend.
- A implementação segue as camadas definidas e não inclui provedores externos, versionamento ou persistência durável de metadados.