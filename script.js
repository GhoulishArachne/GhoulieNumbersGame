const ticketPriceInput = document.getElementById('ticketPrice');
const maxTicketsInput = document.getElementById('maxTickets');
const themeSelect = document.getElementById('themeSelect');
const buyQuantityInput = document.getElementById('buyQuantity');
const ticketNameInput = document.getElementById('ticketName');
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

let tickets = [];
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
        <strong>Ticket #${ticket.ticketNumber}${ticket.name ? ` — ${ticket.name}` : ''}</strong>
        <div>${ticket.numbers.join(', ')}</div>
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

  const winnersByMatch = winners.reduce((acc, win) => {
    acc[win.matchCount] = acc[win.matchCount] || [];
    acc[win.matchCount].push(win);
    return acc;
  }, {});

  const winnersHtml = Object.entries(winnersByMatch)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([matchCount, group]) => {
      const totalForCategory = prizeAmounts[matchCount] || 0;
      const share = group.length ? totalForCategory / group.length : 0;

      return group.map(win => `
        <div class="result-item">
          <strong>Ticket ${win.index + 1}${win.ticket.name ? ` — ${win.ticket.name}` : ''}:</strong>
          <div>Numbers: ${win.ticket.numbers.join(', ')}</div>
          <div>Matches: ${win.matchCount} (${win.matches.join(', ')})</div>
          <div>Prize: ${share > 0 ? formatMoney(share) : 'No prize'}</div>
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
  showResult(result.drawNumbers, result.winners, prizePool, prizeAmounts);
}

function addTicket(numbers, name = '') {
  tickets.push({ numbers, ticketNumber: nextTicketId++, name: name.trim() });
  updateUi();
}

function handleRemoveTicket(event) {
  if (!event.target.dataset.index) return;
  const index = Number(event.target.dataset.index);
  tickets.splice(index, 1);
  updateUi();
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
  const name = ticketNameInput.value;
  for (let i = 0; i < quantity; i += 1) {
    addTicket(randomNumbers(6, 1, 99), name);
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
  addTicket(normalized, ticketNameInput.value);
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

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const selected = button.dataset.tab;
    tabButtons.forEach((btn) => btn.classList.toggle('active', btn === button));
    if (selected === 'settings') {
      buyTab.classList.add('hidden');
      settingsTab.classList.remove('hidden');
    } else {
      settingsTab.classList.add('hidden');
      buyTab.classList.remove('hidden');
    }
  });
});

updateUi();
updateBuySummary();
