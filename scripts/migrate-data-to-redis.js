const fs = require('fs/promises');
const path = require('path');

const defaultState = {
  kv: {
    nextTicketId: 1,
    extraPoolAmount: 0,
    ticketPrice: 500,
    maxTickets: 10,
  },
  tickets: [],
  previous_drawings: [],
};

function normalizeState(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const kv = data.kv && typeof data.kv === 'object' ? data.kv : {};
  const nextTicketId = Number(kv.nextTicketId);
  const extraPoolAmount = Number(kv.extraPoolAmount);
  const ticketPrice = Number(kv.ticketPrice);
  const maxTickets = Number(kv.maxTickets);

  return {
    kv: {
      nextTicketId: Number.isFinite(nextTicketId) && nextTicketId >= 1 ? nextTicketId : 1,
      extraPoolAmount: Number.isFinite(extraPoolAmount) && extraPoolAmount >= 0 ? extraPoolAmount : 0,
      ticketPrice: Number.isFinite(ticketPrice) && ticketPrice >= 0 ? ticketPrice : 500,
      maxTickets: Number.isInteger(maxTickets) && maxTickets >= 1 ? maxTickets : 10,
    },
    tickets: Array.isArray(data.tickets) ? data.tickets : [],
    previous_drawings: Array.isArray(data.previous_drawings) ? data.previous_drawings : [],
  };
}

async function redisCommand(url, token, command) {
  const response = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([command]),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Redis command failed (${response.status}): ${body}`);
  }

  const [result] = await response.json();
  if (result.error) throw new Error(`Redis command failed: ${result.error}`);
  return result.result;
}

async function main() {
  const sourcePath = process.argv[2] || 'data.json';
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  const key = process.env.GHOULIE_STATE_KEY || 'ghoulie-numbers-game:state';

  if (!url || !token) {
    throw new Error('Set KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN first.');
  }

  const raw = JSON.parse(await fs.readFile(path.resolve(sourcePath), 'utf8'));
  const state = normalizeState(raw);

  if (!state.tickets.length && !state.previous_drawings.length) {
    console.warn('Warning: source data has no tickets and no previous drawings.');
  }

  await redisCommand(url, token, ['SET', key, JSON.stringify(state)]);

  console.log(`Migrated ${state.tickets.length} tickets and ${state.previous_drawings.length} drawings to ${key}.`);
  console.log(`Next ticket: ${state.kv.nextTicketId}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
