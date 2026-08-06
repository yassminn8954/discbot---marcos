const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

function getDbPath() {
  return process.env.MENSAGENS_DB_PATH || path.resolve(__dirname, '..', '..', 'data', 'mensagens.db');
}

function ensureDbFile() {
  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  return dbPath;
}

function backupCorruptDb(dbPath, error) {
  const backupPath = `${dbPath}.corrupt-${Date.now()}`;
  try {
    fs.renameSync(dbPath, backupPath);
    console.warn(`SQLite corrupto renomeado para ${backupPath}:`, error.message || error);
  } catch (renameError) {
    console.warn('Falha ao renomear DB corrompido:', renameError.message || renameError);
  }
}

let dbInstance = null;

function hasColumn(db, table, column) {
  const row = db.prepare(`PRAGMA table_info(${table})`).all().find((item) => item.name === column);
  return !!row;
}

function getDb() {
  if (!dbInstance) {
    const dbPath = ensureDbFile();
    try {
      dbInstance = new DatabaseSync(dbPath);
    } catch (error) {
      if (error && error.message && error.message.includes('malformed')) {
        backupCorruptDb(dbPath, error);
        dbInstance = new DatabaseSync(dbPath);
      } else {
        throw error;
      }
    }

    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS mensagens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conteudo TEXT NOT NULL,
        canal_id TEXT NOT NULL,
        status TEXT NOT NULL,
        id_externo TEXT,
        erro_codigo TEXT,
        erro_descricao TEXT,
        payload_bruto TEXT,
        criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    if (!hasColumn(dbInstance, 'mensagens', 'payload_bruto')) {
      dbInstance.exec(`ALTER TABLE mensagens ADD COLUMN payload_bruto TEXT;`);
    }
  }

  return dbInstance;
}

function criarMensagem({ conteudo, canalId, status = 'enfileirada', payloadBruto = null }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO mensagens (conteudo, canal_id, status, id_externo, erro_codigo, erro_descricao, payload_bruto, criado_em, atualizado_em)
    VALUES (?, ?, ?, NULL, NULL, NULL, ?, datetime('now'), datetime('now'))
  `);

  const result = stmt.run(conteudo, canalId, status, payloadBruto);
  return result.lastInsertRowid;
}

function atualizarMensagem(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];

  Object.entries(updates).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value);
  });

  fields.push('atualizado_em = datetime(\'now\')');

  const stmt = db.prepare(`UPDATE mensagens SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values, id);
}

function marcarComoEnviada(id, idExterno) {
  atualizarMensagem(id, {
    status: 'enviada',
    id_externo: idExterno,
    erro_codigo: null,
    erro_descricao: null,
  });
}

function marcarComoFalha(id, codigo, descricao) {
  atualizarMensagem(id, {
    status: 'falha',
    erro_codigo: codigo,
    erro_descricao: descricao,
  });
}

function fecharDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

module.exports = {
  criarMensagem,
  marcarComoEnviada,
  marcarComoFalha,
  fecharDb,
};
