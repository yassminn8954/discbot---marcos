// src/services/discord.js
const BASE = 'https://discord.com/api/v10';
const { criarMensagem, marcarComoEnviada, marcarComoFalha } = require('../db/mensagens');

function getHeaders() {
  return {
    Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

async function enviarNoCanal(canalId, texto, componentes = null) {
  const body = { content: texto };

  if (componentes) {
    body.components = componentes;
  }

  const payloadBruto = JSON.stringify(body);
  const mensagemId = criarMensagem({
    conteudo: texto,
    canalId,
    status: 'enviada',
    payloadBruto,
  });

  try {
    const res = await fetch(`${BASE}/channels/${canalId}/messages`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      const { retry_after } = await res.json();
      const error = new Error('rate limit');
      error.retryAfter = retry_after;
      marcarComoFalha(mensagemId, '429', `rate limit retry_after=${retry_after}`);
      throw error;
    }

    if (!res.ok) {
      const descricao = await res.text();
      marcarComoFalha(mensagemId, String(res.status), descricao);
      throw new Error(`Discord ${res.status}: ${descricao}`);
    }

    const data = await res.json();
    marcarComoEnviada(mensagemId, data.id);
    return data.id;
  } catch (error) {
    if (error && error.retryAfter === undefined && error.message && !error.message.startsWith('Discord')) {
      const descricao = error instanceof Error ? error.message : String(error);
      marcarComoFalha(mensagemId, 'erro', descricao);
    }
    throw error;
  }
}

module.exports = {
  enviarNoCanal,
};
