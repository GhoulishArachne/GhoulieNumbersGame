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
const salesLogList = document.getElementById('salesLogList');
const previousDrawingsList = document.getElementById('previousDrawingsList');
const clearDataBtn = document.getElementById('clearDataBtn');
const clearConfirmRow = document.getElementById('clearConfirmRow');
const confirmClearInput = document.getElementById('confirmClearInput');
const confirmClearBtn = document.getElementById('confirmClearBtn');
const cancelClearBtn = document.getElementById('cancelClearBtn');

let tickets = [];
let previousDrawings = [];
let currentTheme = 'light';
let customMode = false;
let nextTicketId = 1;


function randomNumbers(count, min, max) {
  const numbers = new Set();
  while (numbers.size < count) {
    const value = Math.floor(Math.random() * (max - min + 1)) + min;
    numbers.add(value);
  }
  return Array.from(numbers).sort((a, b) => a - b);
}

function normalizeTicket(numbers) {
  const uniqueNumbers = [...new Set(numbers.map(Number))].filter(n => Number.isInteger(n) && n >= 1 && n <= 99);
  if (uniqueNumbers.length !== 6) return null;
  return uniqueNumbers.sort((a, b) => a - b);
}

function updateBuySummary() {
  const quantity = Math.max(1, Number(buyQuantityInput.value) || 1);
  const price = Number(ticketPriceInput.value) || 0;
  nextTicketNumberText.textContent = nextTicketId;
  currentTotalPriceText.textContent = `$${(quantity * price).toFixed(2)}`;
}

function updateUi() {
  ticketList.innerHTML = '';
  tickets.forEach((ticket, index) => {
    const card = document.createElement('div');
    card.className = 'ticket-card';
    card.innerHTML = `
      <div>
        <strong>Ticket #${ticket.ticketNumber}</strong>
        <div>${ticket.numbers.join(', ')}</div>
        <div class="ticket-meta">Buyer: ${ticket.buyerName} • State ID: ${ticket.stateId}</div>
        <div class="ticket-meta">Sold by: ${ticket.sellerName} • Date: ${ticket.saleDate} • Time: ${ticket.saleTime} EST</div>
      </div>
      <button data-index="${index}" class="secondary">Remove</button>
    `;
    ticketList.appendChild(card);
  });

  if (tickets.length === 0) {
    ticketList.innerHTML = '<p class="help-text">No tickets yet. Use quick pick or custom numbers to add tickets.</p>';
  }

  const price = Number(ticketPriceInput.value) || 0;
  ticketCountText.textContent = `${tickets.length} ticket${tickets.length === 1 ? '' : 's'}`;
  totalCostText.textContent = `$${(tickets.length * price).toFixed(2)}`;
  updateBuySummary();
}

function formatMoney(value) {
  return `$${value.toFixed(2)}`;
}

function getPrizeDistribution(pool) {
  return {
    6: pool * 0.7,
    5: pool * 0.15,
    4: pool * 0.1,
    3: pool * 0.05,
  };
}

function getEasternDateTime() {
  const now = new Date();
  const utcMillis = now.getTime() + now.getTimezoneOffset() * 60000;
  const estMillis = utcMillis - 5 * 60 * 60000;
  const estDate = new Date(estMillis);
  const date = estDate.toISOString().slice(0, 10);
  const time = estDate.toTimeString().slice(0, 8);
  return { saleDate: date, saleTime: time };
}

function updateSalesLog(filter = {}) {
  const filterName = (filter.name || '').trim().toLowerCase();
  const filterDate = (filter.date || '').trim();
  const filterTime = (filter.time || '').trim();

  const rows = tickets.filter((ticket) => {
    const matchesName = filterName === '' || ticket.buyerName.toLowerCase().includes(filterName);
    const matchesDate = filterDate === '' || ticket.saleDate.includes(filterDate);
    const matchesTime = filterTime === '' || ticket.saleTime.includes(filterTime);
    return matchesName && matchesDate && matchesTime;
  });

  salesLogList.innerHTML = rows.length === 0
    ? '<p class="help-text">No sales match the current filters.</p>'
    : rows.map((ticket) => `
      <div class="sales-log-item">
        <strong>Ticket #${ticket.ticketNumber}</strong>
        <div>Buyer: ${ticket.buyerName}</div>
        <div>State ID: ${ticket.stateId}</div>
        <div>Sold by: ${ticket.sellerName}</div>
        <div>Date: ${ticket.saleDate}</div>
        <div>Time: ${ticket.saleTime} EST</div>
        <div>Numbers: ${ticket.numbers.join(', ')}</div>
      </div>
    `).join('');
}

function computeWinnerPrizeBreakdown(winners, prizeAmounts) {
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

function updatePreviousDrawingsUI() {
  if (!previousDrawings.length) {
    previousDrawingsList.innerHTML = '<p class="help-text">No previous drawings yet.</p>';
    return;
  }

  previousDrawingsList.innerHTML = previousDrawings
    .slice()
    .reverse()
    .map((draw) => {
      const winnersHtml = draw.winners.length
        ? draw.winners.map((w) => `
            <div class="result-item">
              <div><strong>Winner ticket #${w.ticketNumber}:</strong> ${formatMoney(w.prizeAmount)}</div>
              <div class="help-text" style="margin:6px 0 0;">Buyer: ${w.buyerName} • State ID: ${w.stateId}</div>
              <div class="help-text" style="margin:6px 0 0;">Numbers: ${w.numbers.join(', ')} • Matches: ${w.matchCount}</div>

            </div>
          `).join('')
        : `<p class="help-text">No winning ticket (3+ matches).</p>`;

      return `
        <div class="previous-drawing-block">
          <div class="previous-drawing-header">
            <strong>Draw: ${draw.drawDate} ${draw.drawTime} EST</strong>
          </div>
          <div class="previous-drawing-subheader">Winning tickets: ${draw.winners.length}</div>
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
      <strong>${count} match${count > 1 ? 'es' : ''}:</strong> ${formatMoney(amount)} total
    </div>
  `).join('');

  if (winners.length === 0) {
    resultDetails.innerHTML = `
      <div class="result-item">
        <strong>Prize pool:</strong> ${formatMoney(prizePool)}
      </div>
      ${distributionHtml}
      <p class="help-text">No ticket matched 3 or more numbers.</p>
    `;

    return;
  }

  const winnersWithPrize = computeWinnerPrizeBreakdown(winners, prizeAmounts);

  const winnersByMatch = winnersWithPrize.reduce((acc, win) => {
    acc[win.matchCount] = acc[win.matchCount] || [];
    acc[win.matchCount].push(win);
    return acc;
  }, {});

  const winnersHtml = Object.entries(winnersByMatch)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([matchCount, group]) => {
      return group.map(win => `
        <div class="result-item">
          <strong>Ticket ${win.index + 1}${win.ticket.name ? ` — ${win.ticket.name}` : ''}:</strong>
          <div>Numbers: ${win.ticket.numbers.join(', ')}</div>
          <div>Matches: ${win.matchCount} (${win.matches.join(', ')})</div>
          <div>Prize: ${win.prizeAmount > 0 ? formatMoney(win.prizeAmount) : 'No prize'}</div>
        </div>
      `).join('');
    }).join('');

  resultDetails.innerHTML = `
    <div class="result-item">
      <strong>Prize pool:</strong> ${formatMoney(prizePool)}
    </div>
    ${distributionHtml}
    ${winnersHtml}
  `;

  return winnersWithPrize;
}

function recordPreviousDrawing(drawNumbers, winnersWithPrize, prizePool) {
  const { saleDate, saleTime } = getEasternDateTime();
  previousDrawings.push({
    drawDate: saleDate,
    drawTime: saleTime,
    prizePool,
    drawnNumbers: drawNumbers.slice(),
    winners: (winnersWithPrize || []).map((w) => ({
      ticketNumber: w.ticket.ticketNumber,
      buyerName: w.ticket.buyerName,
      stateId: w.ticket.stateId,
      numbers: w.ticket.numbers.slice(),
      matchCount: w.matchCount,
      matches: w.matches.slice(),
      prizeAmount: w.prizeAmount,
    })),
  });
  updatePreviousDrawingsUI();
}


function computeMatches(ticket, drawNumbers) {
  const matches = ticket.numbers.filter(value => drawNumbers.includes(value));
  return { matches, matchCount: matches.length };
}

function ensureAtLeastOneWinner(drawNumbers) {
  const winners = tickets.map((ticket, index) => {
    const result = computeMatches(ticket, drawNumbers);
    return { ticket, index, ...result };
  }).filter(x => x.matchCount >= 3);

  if (winners.length > 0) {
    return { drawNumbers, winners };
  }

  if (tickets.length === 0) {
    return { drawNumbers, winners: [] };
  }

  const randomTicketIndex = Math.floor(Math.random() * tickets.length);
  const chosenTicket = tickets[randomTicketIndex];
  const drawSet = new Set();
  const chosenNumbers = [...chosenTicket.numbers];
  const requiredMatches = 3; // Guarantee at least one ticket wins with 3 matches
  const preserved = randomNumbers(requiredMatches, 0, requiredMatches - 1).map(i => chosenNumbers[i]);
  preserved.forEach(n => drawSet.add(n));

  while (drawSet.size < 6) {
    const value = Math.floor(Math.random() * 99) + 1;
    if (!drawSet.has(value)) drawSet.add(value);
  }

  const forcedDraw = Array.from(drawSet).sort((a, b) => a - b);
  const forcedWinners = tickets.map((ticket, index) => {
    const result = computeMatches(ticket, forcedDraw);
    return { ticket, index, ...result };
  }).filter(x => x.matchCount >= 3);

  return { drawNumbers: forcedDraw, winners: forcedWinners };
}

function runDraw() {
  if (tickets.length === 0) {
    alert('Buy at least one ticket before drawing.');
    return;
  }

  const drawNumbers = randomNumbers(6, 1, 99);
  const prizePool = tickets.length * (Number(ticketPriceInput.value) || 0);
  const prizeAmounts = getPrizeDistribution(prizePool);
  const result = ensureAtLeastOneWinner(drawNumbers);
  const winnersWithPrize = showResult(result.drawNumbers, result.winners, prizePool, prizeAmounts) || [];
  recordPreviousDrawing(result.drawNumbers, winnersWithPrize, prizePool);
}


function addTicket(numbers, buyerName, stateId, sellerName) {
  const { saleDate, saleTime } = getEasternDateTime();
  tickets.push({
    numbers,
    ticketNumber: nextTicketId++,
    buyerName: buyerName.trim(),
    stateId: stateId.trim(),
    sellerName: sellerName.trim(),
    saleDate,
    saleTime,
  });
  updateUi();
  updateSalesLog({
    name: logNameSearchInput.value,
    date: logDateSearchInput.value,
    time: logTimeSearchInput.value,
  });
}

function handleRemoveTicket(event) {
  if (!event.target.dataset.index) return;
  const index = Number(event.target.dataset.index);
  tickets.splice(index, 1);
  updateUi();
  updateSalesLog({
    name: logNameSearchInput.value,
    date: logDateSearchInput.value,
    time: logTimeSearchInput.value,
  });
}

function parseCustomInputs() {
  const inputs = Array.from(customInputs.querySelectorAll('input'));
  const values = inputs.map(input => Number(input.value));
  return normalizeTicket(values);
}

quickPickBtn.addEventListener('click', () => {
  const quantity = Math.max(1, Math.min(Number(buyQuantityInput.value) || 1, Number(maxTicketsInput.value) || 1));
  if (quantity > Number(maxTicketsInput.value)) {
    alert(`You can only buy up to ${maxTicketsInput.value} tickets at once.`);
    return;
  }

  const buyerName = buyerNameInput.value.trim();
  const stateId = stateIdInput.value.trim();
  const sellerName = sellerNameInput.value.trim();

  if (!buyerName || !stateId || !sellerName) {
    alert('Please enter a buyer name, State ID, and who sold the ticket.');
    return;
  }

  for (let i = 0; i < quantity; i += 1) {
    addTicket(randomNumbers(6, 1, 99), buyerName, stateId, sellerName);
  }
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
  const buyerName = buyerNameInput.value.trim();
  const stateId = stateIdInput.value.trim();
  const sellerName = sellerNameInput.value.trim();
  if (!buyerName || !stateId || !sellerName) {
    alert('Please enter a buyer name, State ID, and who sold the ticket.');
    return;
  }
  addTicket(normalized, buyerName, stateId, sellerName);
});

ticketList.addEventListener('click', handleRemoveTicket);

drawBtn.addEventListener('click', runDraw);

themeSelect.addEventListener('change', () => {
  currentTheme = themeSelect.value;
  document.body.className = `theme-${currentTheme}`;
});

ticketPriceInput.addEventListener('change', updateUi);
buyQuantityInput.addEventListener('change', updateBuySummary);
maxTicketsInput.addEventListener('change', () => {
  const value = Number(maxTicketsInput.value) || 1;
  maxTicketsInput.value = Math.max(1, value);
  updateBuySummary();
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

confirmClearBtn.addEventListener('click', () => {
  if (confirmClearInput.value.trim().toUpperCase() !== 'CLEAR') {
    alert('Type CLEAR to confirm clearing data.');
    return;
  }

  tickets = [];
  previousDrawings = [];
  nextTicketId = 1;
  updateUi();
  updateSalesLog({
    name: logNameSearchInput.value,
    date: logDateSearchInput.value,
    time: logTimeSearchInput.value,
  });
  updatePreviousDrawingsUI();
  clearConfirmRow.classList.add('hidden');
  confirmClearInput.value = '';
});


logNameSearchInput.addEventListener('input', () => {
  updateSalesLog({
    name: logNameSearchInput.value,
    date: logDateSearchInput.value,
    time: logTimeSearchInput.value,
  });
});

logDateSearchInput.addEventListener('input', () => {
  updateSalesLog({
    name: logNameSearchInput.value,
    date: logDateSearchInput.value,
    time: logTimeSearchInput.value,
  });
});

logTimeSearchInput.addEventListener('input', () => {
  updateSalesLog({
    name: logNameSearchInput.value,
    date: logDateSearchInput.value,
    time: logTimeSearchInput.value,
  });
});

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const selected = button.dataset.tab;
    tabButtons.forEach((btn) => btn.classList.toggle('active', btn === button));
    buyTab.classList.toggle('hidden', selected !== 'buy');
    settingsTab.classList.toggle('hidden', selected !== 'settings');
    logTab.classList.toggle('hidden', selected !== 'log');
    previousTab.classList.toggle('hidden', selected !== 'previous');

    if (selected === 'log') {
      updateSalesLog({
        name: logNameSearchInput.value,
        date: logDateSearchInput.value,
        time: logTimeSearchInput.value,
      });
    }

    if (selected === 'previous') {
      updatePreviousDrawingsUI();
    }
  });
});

updateUi();
updateBuySummary();
updatePreviousDrawingsUI();

