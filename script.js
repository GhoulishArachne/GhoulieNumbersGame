const ticketPriceInput = document.getElementById('ticketPrice');
const maxTicketsInput = document.getElementById('maxTickets');
const themeSelect = document.getElementById('themeSelect');
const buyQuantityInput = document.getElementById('buyQuantity');
const buyerNameInput = document.getElementById('buyerName');
const stateIdInput = document.getElementById('stateId');
const sellerNameInput = document.getElementById('sellerName');
const nextTicketNumberText = document.getElementById('nextTicketNumber');
const currentTotalPriceText = document.getElementById('currentTotalPrice');
const quickPickBtn = document.getElementById('quickPickBtn');
const customPickBtn = document.getElementById('customPickBtn');
const customInputs = document.getElementById('customInputs');
const addCustomTicketBtn = document.getElementById('addCustomTicketBtn');
const ticketList = document.getElementById('ticketList');
const ticketCountText = document.getElementById('ticketCount');
const totalCostText = document.getElementById('totalCost');
const drawBtn = document.getElementById('drawBtn');
const drawnNumbersText = document.getElementById('drawnNumbers');
const winnerCountText = document.getElementById('winnerCount');
const resultDetails = document.getElementById('resultDetails');
const tabButtons = document.querySelectorAll('.tab-button');
const buyTab = document.getElementById('buyTab');
const settingsTab = document.getElementById('settingsTab');
const logTab = document.getElementById('logTab');
const previousTab = document.getElementById('previousTab');
const logNameSearchInput = document.getElementById('logNameSearch');
const logDateSearchInput = document.getElementById('logDateSearch');
const logTimeSearchInput = document.getElementById('logTimeSearch');
const logPickSearchInput = document.getElementById('logPickSearch');
const salesLogList = document.getElementById('salesLogList');
const previousDrawingsList = document.getElementById('previousDrawingsList');
const clearDataBtn = document.getElementById('clearDataBtn');
const clearConfirmRow = document.getElementById('clearConfirmRow');
const confirmClearInput = document.getElementById('confirmClearInput');
const confirmClearBtn = document.getElementById('confirmClearBtn');
const cancelClearBtn = document.getElementById('cancelClearBtn');
const earnedPoolText = document.getElementById('earnedPool');
const extraPoolText = document.getElementById('extraPool');
const totalPoolText = document.getElementById('totalPool');
const extraPoolInput = document.getElementById('extraPoolInput');
const setExtraPoolBtn = document.getElementById('setExtraPoolBtn');
const syncDataBtn = document.getElementById('syncDataBtn');

let tickets = [];
let previousDrawings = [];
let customMode = false;
let nextTicketId = 1;
let extraPoolAmount = 0;
let ticketPrice = Number(ticketPriceInput.value) || 500;
let maxTickets = Number(maxTicketsInput.value) || 10;
let refreshInFlight = false;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function formatMoney(value) {
  return `$${(Number(value) || 0).toFixed(2)}`;
}

function normalizeTicket(numbers) {
  const uniqueNumbers = [...new Set(numbers.map(Number))].filter((n) => Number.isInteger(n) && n >= 1 && n <= 99);
  if (uniqueNumbers.length !== 6) return null;
  return uniqueNumbers.sort((a, b) => a - b);
}

function parsePickNumbersInput(raw) {
  const cleaned = (raw || '').trim();
  if (cleaned === '') return [];
  return Array.from(new Set(
    cleaned
      .split(/[,\s]+/)
      .map((t) => Number(t.trim()))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 99)
  ));
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`);
  return payload;
}

function applyState(state) {
  tickets = Array.isArray(state.tickets) ? state.tickets : [];
  previousDrawings = Array.isArray(state.previousDrawings) ? state.previousDrawings : [];
  nextTicketId = Number(state.nextTicketId) || 1;
  extraPoolAmount = Number(state.extraPoolAmount) || 0;
  ticketPrice = Number(state.ticketPrice) || 0;
  maxTickets = Math.max(1, Number(state.maxTickets) || 1);

  ticketPriceInput.value = String(ticketPrice);
  maxTicketsInput.value = String(maxTickets);
  extraPoolInput.value = String(extraPoolAmount.toFixed(2));

  updateUi();
  updateSalesLogFromInputs();
  updatePreviousDrawingsUI();
  updatePoolDisplay();
}

async function refreshState() {
  if (refreshInFlight) return;
  refreshInFlight = true;
  try {
    const state = await apiRequest('/api/state');
    applyState(state);
  } catch (error) {
    console.error(error);
  } finally {
    refreshInFlight = false;
  }
}

function updateBuySummary() {
  const quantity = Math.max(1, Number(buyQuantityInput.value) || 1);
  nextTicketNumberText.textContent = nextTicketId;
  currentTotalPriceText.textContent = formatMoney(quantity * ticketPrice);
}

function updatePoolDisplay() {
  const earnedFromSales = tickets.length * ticketPrice;
  const totalPool = earnedFromSales + extraPoolAmount;
  earnedPoolText.textContent = formatMoney(earnedFromSales);
  extraPoolText.textContent = formatMoney(extraPoolAmount);
  totalPoolText.textContent = formatMoney(totalPool);
}

function updateUi() {
  ticketList.innerHTML = '';
  tickets.forEach((ticket) => {
    const card = document.createElement('div');
    card.className = 'ticket-card';
    card.innerHTML = `
      <div>
        <strong>Ticket #${escapeHtml(ticket.ticketNumber)}</strong>
        <div>${escapeHtml(ticket.numbers.join(', '))}</div>
        <div class="ticket-meta">Buyer: ${escapeHtml(ticket.buyerName)} &bull; State ID: ${escapeHtml(ticket.stateId)}</div>
        <div class="ticket-meta">Sold by: ${escapeHtml(ticket.sellerName)} &bull; Date: ${escapeHtml(ticket.saleDate)} &bull; Time: ${escapeHtml(ticket.saleTime)} EST</div>
      </div>
      <button data-id="${escapeHtml(ticket.id)}" class="secondary">Remove</button>
    `;
    ticketList.appendChild(card);
  });

  if (tickets.length === 0) {
    ticketList.innerHTML = '<p class="help-text">No tickets yet. Use quick pick or custom numbers to add tickets.</p>';
  }

  ticketCountText.textContent = `${tickets.length} ticket${tickets.length === 1 ? '' : 's'}`;
  totalCostText.textContent = formatMoney(tickets.length * ticketPrice);
  updateBuySummary();
}

function updateSalesLog(filter = {}) {
  const filterName = (filter.name || '').trim().toLowerCase();
  const filterDate = (filter.date || '').trim();
  const filterTime = (filter.time || '').trim();
  const picks = Array.isArray(filter.picks) ? filter.picks : [];

  const rows = tickets.filter((ticket) => {
    const matchesName = filterName === '' || String(ticket.buyerName).toLowerCase().includes(filterName);
    const matchesDate = filterDate === '' || String(ticket.saleDate).includes(filterDate);
    const matchesTime = filterTime === '' || String(ticket.saleTime).includes(filterTime);
    const matchesPicks = picks.length === 0 || picks.every((p) => ticket.numbers.includes(p));
    return matchesName && matchesDate && matchesTime && matchesPicks;
  });

  salesLogList.innerHTML = rows.length === 0
    ? '<p class="help-text">No sales match the current filters.</p>'
    : rows.map((ticket) => `
      <div class="sales-log-item">
        <strong>Ticket #${escapeHtml(ticket.ticketNumber)}</strong>
        <div>Buyer: ${escapeHtml(ticket.buyerName)}</div>
        <div>State ID: ${escapeHtml(ticket.stateId)}</div>
        <div>Sold by: ${escapeHtml(ticket.sellerName)}</div>
        <div>Date: ${escapeHtml(ticket.saleDate)}</div>
        <div>Time: ${escapeHtml(ticket.saleTime)} EST</div>
        <div>Numbers: ${escapeHtml(ticket.numbers.join(', '))}</div>
      </div>
    `).join('');
}

function updateSalesLogFromInputs() {
  updateSalesLog({
    name: logNameSearchInput.value,
    date: logDateSearchInput.value,
    time: logTimeSearchInput.value,
    picks: parsePickNumbersInput(logPickSearchInput?.value),
  });
}

function updatePreviousDrawingsUI() {
  if (!previousDrawings.length) {
    previousDrawingsList.innerHTML = '<p class="help-text">No previous drawings yet.</p>';
    return;
  }

  previousDrawingsList.innerHTML = previousDrawings
    .map((draw) => {
      const winners = Array.isArray(draw.winners) ? draw.winners : [];
      const winnersHtml = winners.length
        ? winners.map((w) => `
            <div class="result-item">
              <div><strong>Winner ticket #${escapeHtml(w.ticketNumber)}:</strong> ${formatMoney(w.prizeAmount)}</div>
              <div class="help-text" style="margin:6px 0 0;">Buyer: ${escapeHtml(w.buyerName)} &bull; State ID: ${escapeHtml(w.stateId)}</div>
              <div class="help-text" style="margin:6px 0 0;">Numbers: ${escapeHtml(w.numbers.join(', '))} &bull; Matches: ${escapeHtml(w.matchCount)}</div>
            </div>
          `).join('')
        : '<p class="help-text">No winning ticket (3+ matches).</p>';

      return `
        <div class="previous-drawing-block">
          <div class="previous-drawing-header">
            <strong>Draw: ${escapeHtml(draw.drawDate)} ${escapeHtml(draw.drawTime)} EST</strong>
          </div>
          <div class="previous-drawing-subheader">Winning tickets: ${winners.length}</div>
          <div class="previous-drawing-winners">
            ${winnersHtml}
          </div>
        </div>
      `;
    })
    .join('');
}

function showResult(drawNumbers, winners, prizePool, prizeAmounts) {
  drawnNumbersText.textContent = drawNumbers.join(', ');
  winnerCountText.textContent = winners.length;

  const distributionHtml = Object.entries(prizeAmounts).map(([count, amount]) => `
    <div class="result-item">
      <strong>${escapeHtml(count)} match${Number(count) > 1 ? 'es' : ''}:</strong> ${formatMoney(amount)} total
    </div>
  `).join('');

  const winnersHtml = winners.length === 0
    ? '<p class="help-text">No ticket matched 3 or more numbers.</p>'
    : winners
      .slice()
      .sort((a, b) => b.matchCount - a.matchCount)
      .map((win) => `
        <div class="result-item">
          <strong>Ticket #${escapeHtml(win.ticket.ticketNumber)}:</strong>
          <div>Buyer: ${escapeHtml(win.ticket.buyerName)}</div>
          <div>Numbers: ${escapeHtml(win.ticket.numbers.join(', '))}</div>
          <div>Matches: ${escapeHtml(win.matchCount)} (${escapeHtml(win.matches.join(', '))})</div>
          <div>Prize: ${formatMoney(win.prizeAmount)}</div>
        </div>
      `).join('');

  resultDetails.innerHTML = `
    <div class="result-item">
      <strong>Prize pool:</strong> ${formatMoney(prizePool)}
    </div>
    ${distributionHtml}
    ${winnersHtml}
  `;
}

function parseCustomInputs() {
  const inputs = Array.from(customInputs.querySelectorAll('input'));
  return normalizeTicket(inputs.map((input) => Number(input.value)));
}

async function addTickets(quantity, customNumbers = null) {
  const buyerName = buyerNameInput.value.trim();
  const stateId = stateIdInput.value.trim();
  const sellerName = sellerNameInput.value.trim();

  if (!buyerName || !stateId || !sellerName) {
    alert('Please enter a buyer name, State ID, and who sold the ticket.');
    return;
  }

  try {
    const payload = { quantity, buyerName, stateId, sellerName };
    if (customNumbers) payload.customNumbers = customNumbers;
    const response = await apiRequest('/api/addTickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    applyState(response.state);
  } catch (error) {
    alert(error.message);
  }
}

quickPickBtn.addEventListener('click', () => {
  const quantity = Math.max(1, Math.min(Number(buyQuantityInput.value) || 1, maxTickets));
  if (quantity > maxTickets) {
    alert(`You can only buy up to ${maxTickets} tickets at once.`);
    return;
  }
  addTickets(quantity);
});

customPickBtn.addEventListener('click', () => {
  customMode = !customMode;
  customInputs.style.display = customMode ? 'grid' : 'none';
  addCustomTicketBtn.style.display = customMode ? 'inline-block' : 'none';
});

addCustomTicketBtn.addEventListener('click', () => {
  const normalized = parseCustomInputs();
  if (!normalized) {
    alert('Enter 6 unique numbers between 1 and 99 for a custom ticket.');
    return;
  }
  addTickets(1, normalized);
});

ticketList.addEventListener('click', async (event) => {
  const id = event.target.dataset.id;
  if (!id) return;
  try {
    const response = await apiRequest('/api/removeTicket', {
      method: 'POST',
      body: JSON.stringify({ ticketDbId: id }),
    });
    applyState(response.state);
  } catch (error) {
    alert(error.message);
  }
});

drawBtn.addEventListener('click', async () => {
  if (tickets.length === 0) {
    alert('Buy at least one ticket before drawing.');
    return;
  }

  try {
    const response = await apiRequest('/api/runDraw', {
      method: 'POST',
      body: JSON.stringify({ ticketPrice }),
    });
    showResult(response.drawNumbers, response.winners, response.prizePool, response.prizeAmounts);
    applyState(response.state);
  } catch (error) {
    alert(error.message);
  }
});

themeSelect.addEventListener('change', () => {
  document.body.className = `theme-${themeSelect.value}`;
});

async function saveSettings() {
  const newTicketPrice = Number(ticketPriceInput.value);
  const newMaxTickets = Number(maxTicketsInput.value);
  if (!Number.isFinite(newTicketPrice) || newTicketPrice < 0 || !Number.isInteger(newMaxTickets) || newMaxTickets < 1) {
    alert('Ticket price must be non-negative and max tickets must be at least 1.');
    return;
  }

  try {
    const response = await apiRequest('/api/updateSettings', {
      method: 'POST',
      body: JSON.stringify({ ticketPrice: newTicketPrice, maxTickets: newMaxTickets }),
    });
    applyState(response.state);
  } catch (error) {
    alert(error.message);
  }
}

ticketPriceInput.addEventListener('change', saveSettings);
maxTicketsInput.addEventListener('change', saveSettings);
buyQuantityInput.addEventListener('change', updateBuySummary);

setExtraPoolBtn.addEventListener('click', async () => {
  const value = Number(extraPoolInput.value);
  if (!Number.isFinite(value) || value < 0) {
    alert('Extra pool must be a non-negative number.');
    return;
  }

  try {
    const response = await apiRequest('/api/updateExtraPool', {
      method: 'POST',
      body: JSON.stringify({ extraPoolAmount: value }),
    });
    applyState(response.state);
  } catch (error) {
    alert(error.message);
  }
});

clearDataBtn.addEventListener('click', () => {
  clearConfirmRow.classList.remove('hidden');
  confirmClearInput.value = '';
  confirmClearInput.focus();
});

cancelClearBtn.addEventListener('click', () => {
  clearConfirmRow.classList.add('hidden');
  confirmClearInput.value = '';
});

confirmClearBtn.addEventListener('click', async () => {
  if (confirmClearInput.value.trim().toUpperCase() !== 'CLEAR') {
    alert('Type CLEAR to confirm clearing data.');
    return;
  }

  try {
    const response = await apiRequest('/api/clearAll', { method: 'POST', body: '{}' });
    applyState(response.state);
    clearConfirmRow.classList.add('hidden');
    confirmClearInput.value = '';
    drawnNumbersText.textContent = '-';
    winnerCountText.textContent = '0';
    resultDetails.innerHTML = '';
  } catch (error) {
    alert(error.message);
  }
});

logNameSearchInput.addEventListener('input', updateSalesLogFromInputs);
logDateSearchInput.addEventListener('input', updateSalesLogFromInputs);
logTimeSearchInput.addEventListener('input', updateSalesLogFromInputs);
if (logPickSearchInput) logPickSearchInput.addEventListener('input', updateSalesLogFromInputs);

syncDataBtn.addEventListener('click', async () => {
  const shouldSync = window.confirm('This will replace the shared game data with the data in data.json. Continue?');
  if (!shouldSync) return;

  syncDataBtn.disabled = true;
  syncDataBtn.textContent = 'Syncing...';

  try {
    const response = await apiRequest('/api/migrateDataJson', { method: 'POST', body: '{}' });
    applyState(response.state);
    alert(`Synced ${response.migrated.tickets} tickets and ${response.migrated.previousDrawings} previous drawings.`);
  } catch (error) {
    alert(error.message);
  } finally {
    syncDataBtn.disabled = false;
    syncDataBtn.textContent = 'Click Me to Sync';
  }
});

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const selected = button.dataset.tab;
    tabButtons.forEach((btn) => btn.classList.toggle('active', btn === button));
    buyTab.classList.toggle('hidden', selected !== 'buy');
    settingsTab.classList.toggle('hidden', selected !== 'settings');
    logTab.classList.toggle('hidden', selected !== 'log');
    previousTab.classList.toggle('hidden', selected !== 'previous');

    if (selected === 'log') updateSalesLogFromInputs();
    if (selected === 'previous') updatePreviousDrawingsUI();
  });
});

refreshState();
setInterval(refreshState, 3000);
window.addEventListener('focus', refreshState);
