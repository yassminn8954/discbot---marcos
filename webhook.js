require('dotenv').config();
const express = require('express');
const nacl = require('tweetnacl');
const { criarMensagem } = require('./src/db/mensagens');
const { enviarNoCanal } = require('./src/services/discord');

const app = express();
const PORT = process.env.PORT || 3000;
const PUB = process.env.DISCORD_PUBLIC_KEY;

app.post(
  '/webhook/discord',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const sig = req.get('X-Signature-Ed25519');
    const ts = req.get('X-Signature-Timestamp');

    const valido = sig && ts && nacl.sign.detached.verify(
      Buffer.concat([Buffer.from(ts), req.body]),
      Buffer.from(sig, 'hex'),
      Buffer.from(PUB, 'hex')
    );

    if (!valido) {
      console.warn('Webhook recebido com assinatura inválida', {
        sig: !!sig,
        ts: !!ts,
      });
      return res.status(401).send('assinatura invalida');
    }

    let payload;
    const rawBody = req.body.toString('utf8');
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      return res.status(400).send('payload invalido');
    }

    criarMensagem({
      conteudo: payload.data?.name || `interaction-${payload.type}`,
      canalId: payload.channel_id || payload.guild_id || process.env.DISCORD_CANAL_ID,
      status: 'recebida',
      payloadBruto: rawBody,
    });

    console.log('Discord interaction recebido', {
      type: payload.type,
      command: payload.data?.name,
      channel_id: payload.channel_id,
      guild_id: payload.guild_id,
    });

    if (payload.type === 1) {
      return res.json({ type: 1 });
    }

    if (payload.type === 2) {
      const assunto = payload.data?.options?.[0]?.value || 'sem assunto';
      const membro = payload.member?.user?.id || 'desconhecido';

      enviarNoCanal(process.env.DISCORD_CANAL_ID, `Recebido do usuário ${membro}: ${assunto}`)
        .catch((error) => console.error('Erro ao enviar resposta ao canal:', error));

      return res.json({
        type: 4,
        data: {
          content: `Recebido: ${assunto}`,
        },
      });
    }

    if (payload.type === 3) {
      return res.json({
        type: 7,
        data: {
          content: 'Confirmado!',
          components: [],
        },
      });
    }

    res.sendStatus(400);
  }
);

app.listen(PORT, () => {
  console.log(`webhook discord on :${PORT}`);
});
