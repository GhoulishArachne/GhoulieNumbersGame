const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

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

class LocalJsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.queue = Promise.resolve();
  }

  async read() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return clone(defaultState);
    }
  }

  async write(state) {
    await fs.writeFile(this.filePath, `${JSON.stringify(normalizeState(state), null, 2)}\n`);
  }

  async transaction(fn) {
    const run = this.queue.then(async () => {
      const state = await this.read();
      const result = await fn(state);
      await this.write(state);
      return result;
    });
    this.queue = run.catch(() => {});
    return run;
  }
}

class RedisRestStore {
  constructor({ url, token, key }) {
    this.url = url.replace(/\/$/, '');
    this.token = token;
    this.key = key;
  }

  async command(command) {
    const response = await fetch(`${this.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
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

  async read() {
    const raw = await this.command(['GET', this.key]);
    if (!raw) return clone(defaultState);
    return normalizeState(JSON.parse(raw));
  }

  async write(state) {
    await this.command(['SET', this.key, JSON.stringify(normalizeState(state))]);
  }

  async transaction(fn) {
    // A single Redis document keeps every user and Vercel instance pointed at
    // one source of truth. For heavy traffic, move this to Redis hashes/lists.
    const state = await this.read();
    const result = await fn(state);
    await this.write(state);
    return result;
  }
}

class MissingCloudStore {
  async read() {
    const error = new Error('Vercel deployments need KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN for shared data.');
    error.status = 503;
    throw error;
  }

  async transaction() {
    return this.read();
  }
}

function createStore() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return new RedisRestStore({
      url,
      token,
      key: process.env.GHOULIE_STATE_KEY || 'ghoulie-numbers-game:state',
    });
  }

  if (process.env.VERCEL) return new MissingCloudStore();

  return new LocalJsonStore(path.join(__dirname, 'data.json'));
}

const store = createStore();

function normalizeTicket(numbers) {
  const uniqueNumbers = [...new Set((numbers || []).map(Number))].filter(
    (n) => Number.isInteger(n) && n >= 1 && n <= 99
  );
  if (uniqueNumbers.length !== 6) return null;
  return uniqueNumbers.sort((a, b) => a - b);
}

function randomNumbers(count, min, max) {
  const numbers = new Set();
  while (numbers.size < count) {
    const value = Math.floor(Math.random() * (max - min + 1)) + min;
    numbers.add(value);
  }
  return Array.from(numbers).sort((a, b) => a - b);
}

function getEasternDateTime() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]));
  return {
    saleDate: `${parts.year}-${parts.month}-${parts.day}`,
    saleTime: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

function computeMatches(ticket, drawNumbers) {
  const matches = ticket.numbers.filter((value) => drawNumbers.includes(value));
  return { matches, matchCount: matches.length };
}

function ensureAtLeastOneWinner({ drawNumbers, tickets }) {
  const winners = tickets
    .map((ticket, index) => ({ ticket, index, ...computeMatches(ticket, drawNumbers) }))
    .filter((x) => x.matchCount >= 3);

  if (winners.length > 0 || tickets.length === 0) {
    return { drawNumbers, winners };
  }

  const r = Math.random();
  let targetMatchCount = 3;
  if (r < 0.40) targetMatchCount = 4;
  else if (r < 0.65) targetMatchCount = 5;
  else if (r < 0.70) targetMatchCount = 6;

  const chosenTicket = tickets[Math.floor(Math.random() * tickets.length)];
  const chosenNumbers = [...chosenTicket.numbers];
  const drawSet = new Set();
  const preservedIndices = new Set();

  while (preservedIndices.size < targetMatchCount) {
    preservedIndices.add(Math.floor(Math.random() * 6));
  }

  Array.from(preservedIndices).forEach((i) => drawSet.add(chosenNumbers[i]));

  const chosenSet = new Set(chosenNumbers);
  while (drawSet.size < 6) {
    const value = Math.floor(Math.random() * 99) + 1;
    if (!drawSet.has(value) && !chosenSet.has(value)) drawSet.add(value);
  }

  const forcedDraw = Array.from(drawSet).sort((a, b) => a - b);
  const forcedWinners = tickets
    .map((ticket, index) => ({ ticket, index, ...computeMatches(ticket, forcedDraw) }))
    .filter((x) => x.matchCount >= 3);

  return { drawNumbers: forcedDraw, winners: forcedWinners };
}

function getPrizeDistribution(pool) {
  return {
    6: pool * 0.7,
    5: pool * 0.15,
    4: pool * 0.1,
    3: pool * 0.05,
  };
}

function computeWinnerPrizeBreakdown({ winners, prizeAmounts }) {
  const winnersByMatch = winners.reduce((acc, win) => {
    acc[win.matchCount] = acc[win.matchCount] || [];
    acc[win.matchCount].push(win);
    return acc;
  }, {});

  return winners.map((win) => {
    const totalForCategory = prizeAmounts[win.matchCount] || 0;
    const group = winnersByMatch[win.matchCount] || [];
    const share = group.length ? totalForCategory / group.length : 0;
    return { ...win, prizeAmount: share };
  });
}

function getTickets(state) {
  return state.tickets
    .slice()
    .sort((a, b) => Number(a.ticketNumber) - Number(b.ticketNumber))
    .map((t) => ({
      ticketNumber: t.ticketNumber,
      numbers: t.numbers,
      buyerName: t.buyerName,
      stateId: t.stateId,
      sellerName: t.sellerName,
      saleDate: t.saleDate,
      saleTime: t.saleTime,
      id: t._id,
    }));
}

function getPreviousDrawings(state) {
  return state.previous_drawings
    .slice()
    .sort((a, b) => String(b._id).localeCompare(String(a._id)))
    .map((d) => ({
      drawDate: d.drawDate,
      drawTime: d.drawTime,
      prizePool: d.prizePool,
      drawnNumbers: d.drawnNumbers,
      winners: d.winners,
    }));
}

function buildStateResponse(state) {
  return {
    tickets: getTickets(state),
    previousDrawings: getPreviousDrawings(state),
    nextTicketId: state.kv.nextTicketId,
    extraPoolAmount: state.kv.extraPoolAmount,
    ticketPrice: state.kv.ticketPrice,
    maxTickets: state.kv.maxTickets,
  };
}

app.get('/api/state', async (req, res, next) => {
  try {
    res.json(buildStateResponse(await store.read()));
  } catch (error) {
    next(error);
  }
});

app.post('/api/addTickets', async (req, res, next) => {
  try {
    const { quantity, buyerName, stateId, sellerName, customNumbers } = req.body || {};
    const q = Number(quantity);
    if (!Number.isInteger(q) || q < 1 || q > 100) return res.status(400).json({ error: 'Invalid quantity' });

    const buyer = String(buyerName || '').trim();
    const stateIdValue = String(stateId || '').trim();
    const seller = String(sellerName || '').trim();
    if (!buyer || !stateIdValue || !seller) return res.status(400).json({ error: 'Missing buyer/state/seller' });

    const baseNumbers = Array.isArray(customNumbers) ? normalizeTicket(customNumbers) : null;
    if (Array.isArray(customNumbers) && !baseNumbers) {
      return res.status(400).json({ error: 'Custom ticket must have 6 unique numbers from 1 to 99' });
    }

    const state = await store.transaction(async (data) => {
      if (q > data.kv.maxTickets) {
        const error = new Error(`You can only buy up to ${data.kv.maxTickets} tickets at once.`);
        error.status = 400;
        throw error;
      }

      const { saleDate, saleTime } = getEasternDateTime();
      let nextTicketId = Number(data.kv.nextTicketId) || 1;

      for (let i = 0; i < q; i += 1) {
        const ticketNumber = nextTicketId;
        data.tickets.push({
          ticketNumber,
          numbers: baseNumbers ? [...baseNumbers] : randomNumbers(6, 1, 99),
          buyerName: buyer,
          stateId: stateIdValue,
          sellerName: seller,
          saleDate,
          saleTime,
          _id: `${ticketNumber}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        });
        nextTicketId += 1;
      }

      data.kv.nextTicketId = nextTicketId;
      return data;
    });

    res.json({ ok: true, state: buildStateResponse(state) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/removeTicket', async (req, res, next) => {
  try {
    const id = String((req.body || {}).ticketDbId || '').trim();
    if (!id) return res.status(400).json({ error: 'Invalid ticketDbId' });

    const state = await store.transaction(async (data) => {
      data.tickets = data.tickets.filter((t) => String(t._id) !== id);
      return data;
    });

    res.json({ ok: true, state: buildStateResponse(state) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/updateExtraPool', async (req, res, next) => {
  try {
    const v = Number((req.body || {}).extraPoolAmount);
    if (!Number.isFinite(v) || v < 0) return res.status(400).json({ error: 'Invalid extraPoolAmount' });

    const state = await store.transaction(async (data) => {
      data.kv.extraPoolAmount = v;
      return data;
    });

    res.json({ ok: true, state: buildStateResponse(state) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/updateSettings', async (req, res, next) => {
  try {
    const ticketPrice = Number((req.body || {}).ticketPrice);
    const maxTickets = Number((req.body || {}).maxTickets);
    if (!Number.isFinite(ticketPrice) || ticketPrice < 0) {
      return res.status(400).json({ error: 'Invalid ticketPrice' });
    }
    if (!Number.isInteger(maxTickets) || maxTickets < 1) {
      return res.status(400).json({ error: 'Invalid maxTickets' });
    }

    const state = await store.transaction(async (data) => {
      data.kv.ticketPrice = ticketPrice;
      data.kv.maxTickets = maxTickets;
      return data;
    });

    res.json({ ok: true, state: buildStateResponse(state) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/clearAll', async (req, res, next) => {
  try {
    const state = await store.transaction(async (data) => {
      data.tickets = [];
      data.previous_drawings = [];
      data.kv.nextTicketId = 1;
      data.kv.extraPoolAmount = 0;
      return data;
    });

    res.json({ ok: true, state: buildStateResponse(state) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/migrateDataJson', async (req, res, next) => {
  try {
    const sourcePath = process.env.GHOULIE_MIGRATION_FILE || path.join(__dirname, 'data.json');
    const raw = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
    const migratedState = normalizeState(raw);

    if (typeof store.write !== 'function') {
      const error = new Error('Shared store is not configured for migration.');
      error.status = 503;
      throw error;
    }

    await store.write(migratedState);

    res.json({
      ok: true,
      migrated: {
        tickets: migratedState.tickets.length,
        previousDrawings: migratedState.previous_drawings.length,
        nextTicketId: migratedState.kv.nextTicketId,
      },
      state: buildStateResponse(migratedState),
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      error.status = 404;
      error.message = 'data.json was not found on the server.';
    }
    next(error);
  }
});

app.post('/api/runDraw', async (req, res, next) => {
  try {
    const state = await store.transaction(async (data) => {
      const price = Number(data.kv.ticketPrice) || 0;
      const tickets = getTickets(data).map((t) => ({
        ticketNumber: t.ticketNumber,
        numbers: t.numbers,
        buyerName: t.buyerName,
        stateId: t.stateId,
        sellerName: t.sellerName,
        saleDate: t.saleDate,
        saleTime: t.saleTime,
      }));

      if (tickets.length === 0) {
        const error = new Error('No tickets');
        error.status = 400;
        throw error;
      }

      const extraPoolAmount = Number(data.kv.extraPoolAmount) || 0;
      const earnedFromSales = tickets.length * price;
      const prizePool = earnedFromSales + extraPoolAmount;
      const prizeAmounts = getPrizeDistribution(prizePool);
      const { drawNumbers: finalDraw, winners } = ensureAtLeastOneWinner({
        drawNumbers: randomNumbers(6, 1, 99),
        tickets,
      });
      const winnersWithPrize = computeWinnerPrizeBreakdown({ winners, prizeAmounts });
      const { saleDate, saleTime } = getEasternDateTime();

      data.previous_drawings.push({
        _id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        drawDate: saleDate,
        drawTime: saleTime,
        prizePool,
        drawnNumbers: finalDraw,
        winners: winnersWithPrize.map((w) => ({
          ticketNumber: w.ticket.ticketNumber,
          buyerName: w.ticket.buyerName,
          stateId: w.ticket.stateId,
          numbers: w.ticket.numbers,
          matchCount: w.matchCount,
          matches: w.matches,
          prizeAmount: w.prizeAmount,
        })),
      });

      return {
        state: data,
        result: {
          drawNumbers: finalDraw,
          winners: winnersWithPrize,
          prizePool,
          prizeAmounts,
        },
      };
    });

    res.json({ ok: true, ...state.result, state: buildStateResponse(state.state) });
  } catch (error) {
    next(error);
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/script.js', (req, res) => res.sendFile(path.join(__dirname, 'script.js')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));

app.use((error, req, res, next) => {
  const status = error.status || 500;
  res.status(status).json({ error: status === 500 ? 'Server error' : error.message });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
