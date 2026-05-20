const ticketPriceInput = document.getElementById('ticketPrice');
const maxTicketsInput = document.getElementById('maxTickets');
const themeSelect = document.getElementById('themeSelect');
const buyQuantityInput = document.getElementById('buyQuantity');
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

let tickets = [];
let currentTheme = 'light';
let customMode = false;

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

function updateUi() {
  ticketList.innerHTML = '';
  tickets.forEach((ticket, index) => {
    const card = document.createElement('div');
    card.className = 'ticket-card';
    card.innerHTML = `
      <div>
        <strong>Ticket ${index + 1}</strong>
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
}

function showResult(drawNumbers, winners) {
  drawnNumbersText.textContent = drawNumbers.join(', ');
  winnerCountText.textContent = winners.length;
  resultDetails.innerHTML = winners.length === 0
    ? '<p class="help-text">No ticket matched 2 or more numbers.</p>'
    : winners.map(win => `
      <div class="result-item">
        <strong>Ticket ${win.index + 1}:</strong> ${win.ticket.numbers.join(', ')}
        <div>Matches: ${win.matchCount} (${win.matches.join(', ')})</div>
      </div>
    `).join('');
}

function computeMatches(ticket, drawNumbers) {
  const matches = ticket.numbers.filter(value => drawNumbers.includes(value));
  return { matches, matchCount: matches.length };
}

function ensureAtLeastOneWinner(drawNumbers) {
  const winners = tickets.map((ticket, index) => {
    const result = computeMatches(ticket, drawNumbers);
    return { ticket, index, ...result };
  }).filter(x => x.matchCount >= 2);

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
  const requiredMatches = Math.min(6, 2 + Math.floor(Math.random() * 3));
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
  }).filter(x => x.matchCount >= 2);

  return { drawNumbers: forcedDraw, winners: forcedWinners };
}

function runDraw() {
  if (tickets.length === 0) {
    alert('Buy at least one ticket before drawing.');
    return;
  }

  const drawNumbers = randomNumbers(6, 1, 99);
  const result = ensureAtLeastOneWinner(drawNumbers);
  showResult(result.drawNumbers, result.winners);
}

function addTicket(numbers) {
  tickets.push({ numbers });
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
  for (let i = 0; i < quantity; i += 1) {
    addTicket(randomNumbers(6, 1, 99));
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
  addTicket(normalized);
});

ticketList.addEventListener('click', handleRemoveTicket);

drawBtn.addEventListener('click', runDraw);

themeSelect.addEventListener('change', () => {
  currentTheme = themeSelect.value;
  document.body.className = `theme-${currentTheme}`;
});

ticketPriceInput.addEventListener('change', updateUi);
maxTicketsInput.addEventListener('change', () => {
  const value = Number(maxTicketsInput.value) || 1;
  maxTicketsInput.value = Math.max(1, value);
});

updateUi();
