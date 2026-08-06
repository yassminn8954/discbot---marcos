const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

process.env.MENSAGENS_DB_PATH = path.join(__dirname, 'fixtures', 'mensagens-test.db');

const { criarMensagem, marcarComoEnviada, marcarComoFalha, fecharDb } = require('../src/db/mensagens');

test('deve criar mensagem em estado enfileirada e atualizar para enviada', () => {
  fs.rmSync(process.env.MENSAGENS_DB_PATH, { force: true });

  const id = criarMensagem({ conteudo: 'teste', canalId: '123' });
  assert.ok(id);

  marcarComoEnviada(id, 'msg-456');

  const db = require('node:sqlite').DatabaseSync;
  const connection = new db(process.env.MENSAGENS_DB_PATH);
  const row = connection.prepare('SELECT status, id_externo FROM mensagens WHERE id = ?').get(id);

  assert.equal(row.status, 'enviada');
  assert.equal(row.id_externo, 'msg-456');

  connection.close();
  fecharDb();
});

test('deve registrar falha com código e descrição', () => {
  fs.rmSync(process.env.MENSAGENS_DB_PATH, { force: true });

  const id = criarMensagem({ conteudo: 'erro', canalId: '123' });
  marcarComoFalha(id, '500', 'erro interno');

  const db = require('node:sqlite').DatabaseSync;
  const connection = new db(process.env.MENSAGENS_DB_PATH);
  const row = connection.prepare('SELECT status, erro_codigo, erro_descricao FROM mensagens WHERE id = ?').get(id);

  assert.equal(row.status, 'falha');
  assert.equal(row.erro_codigo, '500');
  assert.equal(row.erro_descricao, 'erro interno');

  connection.close();
  fecharDb();
});
