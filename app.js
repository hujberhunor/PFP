const STORAGE_WALLETS = 'wallets';
const STORAGE_CURRENT_WALLET = 'currentWalletId';
const STORAGE_TRIPS = 'trips';
const STORAGE_CURRENT_TRIP = 'currentTripId';
const DEFAULT_WALLET_NAME = 'Alap';
const defaultCategories = [
    { name: '🍕 Étel', monthlyLimit: 14000 },
    { name: '🍺 Alkohol', monthlyLimit: 12000 },
    { name: '✨ Egyéb', monthlyLimit: 12000 },
    { name: '🐸 Tisztálkodás', monthlyLimit: 6000 },
    { name: '🎁 Ajándék', monthlyLimit: 0 },
    { name: '🛒 Bevásárlás', monthlyLimit: 24000 },
    { name: '🦕 Szórakozás', monthlyLimit: 16000 },
    { name: '🍪 Édesség/Üdítő', monthlyLimit: 6000 }
];
const categoryAliases = {
    '🍪 Édesség': '🍪 Édesség/Üdítő'
};

function readJSON(key, fallback = null) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
        console.warn(`Nem sikerült beolvasni a(z) ${key} adatot.`, error);
        return fallback;
    }
}

function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function formatFt(value) {
    return `${Math.round(value).toLocaleString('hu-HU')} Ft`;
}

function parseNonNegativeInt(value) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parsePositiveNumber(value) {
    const normalized = typeof value === 'string' ? value.replace(',', '.') : value;
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function generateId() {
    return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeCategories(list) {
    if (!Array.isArray(list)) { return []; }
    return list.map(item => {
        const name = typeof item?.name === 'string' ? item.name.trim() : '';
        const monthlyRaw = parseInt(item?.monthlyLimit, 10);
        const weeklyRaw = parseInt(item?.weeklyLimit, 10);
        const legacyRaw = parseInt(item?.limit, 10);
        const monthlyLimit = Number.isFinite(monthlyRaw)
            ? Math.max(0, monthlyRaw)
            : (Number.isFinite(weeklyRaw) ? Math.max(0, weeklyRaw * 4) : (Number.isFinite(legacyRaw) ? Math.max(0, legacyRaw * 4) : 0));
        return { name, monthlyLimit };
    }).filter(item => item.name);
}

function loadLegacyCategories() {
    const saved = readJSON('categories');
    if (Array.isArray(saved) && saved.length) {
        return normalizeCategories(saved);
    }
    if (saved && typeof saved === 'object') {
        return Object.keys(saved).map(name => {
            const legacy = parseInt(saved[name], 10);
            return { name, monthlyLimit: Number.isFinite(legacy) ? legacy * 4 : 0 };
        }).filter(item => item.name);
    }
    return defaultCategories.map(cat => ({ ...cat }));
}

function normalizeExpenses(expenses) {
    let changed = false;
    const normalized = (Array.isArray(expenses) ? expenses : []).map(item => {
        const id = typeof item?.id === 'string' && item.id ? item.id : generateId().replace('w_', 'x_');
        const amount = parseInt(item?.amount, 10);
        const rawCat = typeof item?.cat === 'string' ? item.cat : '';
        const cat = categoryAliases[rawCat] || rawCat;
        const date = typeof item?.date === 'string' ? item.date : formatLocalDate(new Date());
        const note = typeof item?.note === 'string' ? item.note : '';

        if (id !== item?.id || cat !== rawCat || amount !== item?.amount || date !== item?.date || note !== item?.note) {
            changed = true;
        }
        return { id, date, cat, amount: Number.isFinite(amount) && amount > 0 ? amount : 0, note };
    }).filter(item => item.cat && item.amount > 0);
    return { normalized, changed };
}

function normalizeWallet(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const name = typeof source.name === 'string' && source.name.trim() ? source.name.trim() : DEFAULT_WALLET_NAME;
    const id = source.id || generateId();
    const categories = normalizeCategories(source.categories || []);
    const fallbackCategories = categories.length ? categories : defaultCategories.map(cat => ({ ...cat }));
    const expensesRaw = Array.isArray(source.expenses) ? source.expenses : [];
    const { normalized, changed } = normalizeExpenses(expensesRaw);
    return { wallet: { id, name, categories: fallbackCategories, expenses: normalized }, changed };
}

function loadWallets() {
    const saved = readJSON(STORAGE_WALLETS);
    if (Array.isArray(saved) && saved.length) {
        let changed = false;
        const wallets = saved.map(raw => {
            const result = normalizeWallet(raw);
            if (result.changed) { changed = true; }
            return result.wallet;
        });
        if (changed) {
            writeJSON(STORAGE_WALLETS, wallets);
        }
        return wallets;
    }
    const legacyCategories = loadLegacyCategories();
    const legacyExpenses = readJSON('expenses', []) || [];
    const result = normalizeWallet({
        id: generateId(),
        name: DEFAULT_WALLET_NAME,
        categories: legacyCategories,
        expenses: legacyExpenses
    });
    const wallets = [result.wallet];
    writeJSON(STORAGE_WALLETS, wallets);
    localStorage.setItem(STORAGE_CURRENT_WALLET, wallets[0].id);
    return wallets;
}

function loadCurrentWalletId(wallets) {
    const savedId = localStorage.getItem(STORAGE_CURRENT_WALLET);
    if (savedId && wallets.some(wallet => wallet.id === savedId)) {
        return savedId;
    }
    const fallback = wallets[0]?.id;
    if (fallback) {
        localStorage.setItem(STORAGE_CURRENT_WALLET, fallback);
    }
    return fallback;
}

function persistWallets() {
    writeJSON(STORAGE_WALLETS, wallets);
}

function getCurrentWallet() {
    return wallets.find(wallet => wallet.id === currentWalletId) || wallets[0];
}

function updateCurrentWallet() {
    currentWallet = getCurrentWallet();
    if (!currentWallet) { return; }
    categories = currentWallet.categories;
    data = currentWallet.expenses;
}


function normalizePeople(list) {
    if (!Array.isArray(list)) { return []; }
    const seen = new Set();
    return list.map(person => typeof person === 'string' ? person.trim() : '')
        .filter(Boolean)
        .filter(person => {
            const key = person.toLowerCase();
            if (seen.has(key)) { return false; }
            seen.add(key);
            return true;
        });
}

function normalizeTripExpense(item, people) {
    const source = item && typeof item === 'object' ? item : {};
    const amount = parsePositiveNumber(source.amount);
    const paidBy = typeof source.paidBy === 'string' ? source.paidBy.trim() : '';
    const splitBetween = normalizePeople(source.splitBetween || []).filter(person => people.includes(person));
    return {
        id: source.id || generateId().replace('w_', 'e_'),
        date: typeof source.date === 'string' ? source.date : formatLocalDate(new Date()),
        description: typeof source.description === 'string' ? source.description.trim() : '',
        amount: amount || 0,
        paidBy,
        splitBetween
    };
}

function normalizeTrip(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const people = normalizePeople(source.people || []);
    const expenses = (Array.isArray(source.expenses) ? source.expenses : [])
        .map(item => normalizeTripExpense(item, people))
        .filter(item => item.amount > 0 && item.paidBy && people.includes(item.paidBy) && item.splitBetween.length);
    return {
        id: source.id || generateId().replace('w_', 't_'),
        name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : 'Utazás',
        currency: typeof source.currency === 'string' && source.currency.trim() ? source.currency.trim().toUpperCase() : 'EUR',
        people,
        expenses
    };
}

function loadTrips() {
    const saved = readJSON(STORAGE_TRIPS, []);
    if (!Array.isArray(saved)) { return []; }
    return saved.map(normalizeTrip).filter(trip => trip.name);
}

function persistTrips() {
    writeJSON(STORAGE_TRIPS, trips);
}

function getCurrentTrip() {
    return trips.find(trip => trip.id === currentTripId) || trips[0] || null;
}

function setCurrentTrip(id) {
    if (!trips.some(trip => trip.id === id)) { return; }
    currentTripId = id;
    localStorage.setItem(STORAGE_CURRENT_TRIP, id);
    renderTrips();
}

function loadCurrentTripId(tripsList) {
    const savedId = localStorage.getItem(STORAGE_CURRENT_TRIP);
    if (savedId && tripsList.some(trip => trip.id === savedId)) { return savedId; }
    const fallback = tripsList[0]?.id || '';
    if (fallback) { localStorage.setItem(STORAGE_CURRENT_TRIP, fallback); }
    return fallback;
}

function formatCurrencyAmount(value, currency) {
    const rounded = Math.round((Number(value) || 0) * 100) / 100;
    const fractionDigits = Number.isInteger(rounded) ? 0 : 2;
    return `${rounded.toLocaleString('hu-HU', { minimumFractionDigits: fractionDigits, maximumFractionDigits: 2 })} ${currency}`;
}

function calculateTripBalances(trip) {
    const balances = Object.fromEntries(trip.people.map(person => [person, 0]));
    trip.expenses.forEach(expense => {
        if (!balances.hasOwnProperty(expense.paidBy) || !expense.splitBetween.length) { return; }
        balances[expense.paidBy] += expense.amount;
        const share = expense.amount / expense.splitBetween.length;
        expense.splitBetween.forEach(person => {
            if (balances.hasOwnProperty(person)) { balances[person] -= share; }
        });
    });
    Object.keys(balances).forEach(person => {
        balances[person] = Math.round(balances[person] * 100) / 100;
    });
    return balances;
}

function calculateTripSettlements(trip) {
    const balances = calculateTripBalances(trip);
    const debtors = Object.entries(balances)
        .filter(([, balance]) => balance < -0.005)
        .map(([person, balance]) => ({ person, amount: Math.abs(balance) }))
        .sort((a, b) => b.amount - a.amount);
    const creditors = Object.entries(balances)
        .filter(([, balance]) => balance > 0.005)
        .map(([person, balance]) => ({ person, amount: balance }))
        .sort((a, b) => b.amount - a.amount);
    const settlements = [];
    let d = 0;
    let c = 0;
    while (d < debtors.length && c < creditors.length) {
        const amount = Math.min(debtors[d].amount, creditors[c].amount);
        if (amount > 0.005) {
            settlements.push({ from: debtors[d].person, to: creditors[c].person, amount: Math.round(amount * 100) / 100 });
        }
        debtors[d].amount = Math.round((debtors[d].amount - amount) * 100) / 100;
        creditors[c].amount = Math.round((creditors[c].amount - amount) * 100) / 100;
        if (debtors[d].amount <= 0.005) { d += 1; }
        if (creditors[c].amount <= 0.005) { c += 1; }
    }
    return settlements;
}

function renderTripSelect() {
    const select = document.getElementById('trip-select');
    if (!select) { return; }
    select.innerHTML = '';
    if (!trips.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Nincs utazás';
        select.appendChild(option);
        select.disabled = true;
        return;
    }
    select.disabled = false;
    trips.forEach(trip => {
        const option = document.createElement('option');
        option.value = trip.id;
        option.textContent = `${trip.name} · ${trip.currency}`;
        select.appendChild(option);
    });
    select.value = currentTripId;
}

function renderTripPeople(trip) {
    const list = document.getElementById('trip-people-list');
    if (!list) { return; }
    list.innerHTML = '';
    if (!trip || !trip.people.length) {
        const empty = document.createElement('div');
        empty.className = 'period-label';
        empty.textContent = 'Nincs résztvevő.';
        list.appendChild(empty);
        return;
    }
    trip.people.forEach(person => {
        const pill = document.createElement('span');
        pill.className = 'pill';
        pill.textContent = person;
        list.appendChild(pill);
    });
}

function renderTripExpenseForm(trip) {
    const form = document.getElementById('trip-expense-form');
    const paidBy = document.getElementById('trip-paid-by');
    const splitBox = document.getElementById('trip-split-between');
    if (!form || !paidBy || !splitBox) { return; }
    const enabled = Boolean(trip && trip.people.length);
    form.classList.toggle('disabled-block', !enabled);
    form.querySelectorAll('input, select, button').forEach(el => { el.disabled = !enabled; });
    paidBy.innerHTML = '';
    splitBox.innerHTML = '';
    if (!enabled) { return; }
    trip.people.forEach(person => {
        const option = document.createElement('option');
        option.value = person;
        option.textContent = person;
        paidBy.appendChild(option);

        const label = document.createElement('label');
        label.className = 'check-row';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = person;
        checkbox.checked = true;
        const span = document.createElement('span');
        span.textContent = person;
        label.appendChild(checkbox);
        label.appendChild(span);
        splitBox.appendChild(label);
    });
}

function renderTripSummary(trip) {
    const box = document.getElementById('trip-summary');
    if (!box) { return; }
    box.innerHTML = '';
    if (!trip) {
        const empty = document.createElement('div');
        empty.className = 'card';
        empty.textContent = 'Hozz létre egy utazást az elszámoláshoz.';
        box.appendChild(empty);
        return;
    }
    const total = trip.expenses.reduce((sum, item) => sum + item.amount, 0);
    const totalCard = document.createElement('div');
    totalCard.className = 'card summary-card';
    const title = document.createElement('strong');
    title.textContent = trip.name;
    const meta = document.createElement('div');
    meta.className = 'stat-remaining';
    meta.textContent = `${formatCurrencyAmount(total, trip.currency)} összes közös költés · ${trip.people.length} résztvevő`;
    totalCard.appendChild(title);
    totalCard.appendChild(meta);
    box.appendChild(totalCard);

    const balances = calculateTripBalances(trip);
    const balanceCard = document.createElement('div');
    balanceCard.className = 'card';
    const balanceTitle = document.createElement('strong');
    balanceTitle.textContent = 'Egyenlegek';
    balanceCard.appendChild(balanceTitle);
    Object.entries(balances).forEach(([person, balance]) => {
        const row = document.createElement('div');
        row.className = 'settlement-row';
        const name = document.createElement('span');
        name.textContent = person;
        const value = document.createElement('span');
        value.textContent = balance >= 0
            ? `kap: ${formatCurrencyAmount(balance, trip.currency)}`
            : `tartozik: ${formatCurrencyAmount(Math.abs(balance), trip.currency)}`;
        row.appendChild(name);
        row.appendChild(value);
        balanceCard.appendChild(row);
    });
    box.appendChild(balanceCard);

    const settlements = calculateTripSettlements(trip);
    const settlementCard = document.createElement('div');
    settlementCard.className = 'card';
    const settlementTitle = document.createElement('strong');
    settlementTitle.textContent = 'Legegyszerűbb rendezés';
    settlementCard.appendChild(settlementTitle);
    if (!settlements.length) {
        const done = document.createElement('div');
        done.className = 'period-label';
        done.textContent = 'Mindenki rendezve van.';
        settlementCard.appendChild(done);
    } else {
        settlements.forEach(item => {
            const row = document.createElement('div');
            row.className = 'settlement-row';
            const text = document.createElement('span');
            text.textContent = `${item.from} → ${item.to}`;
            const amount = document.createElement('span');
            amount.textContent = formatCurrencyAmount(item.amount, trip.currency);
            row.appendChild(text);
            row.appendChild(amount);
            settlementCard.appendChild(row);
        });
    }
    box.appendChild(settlementCard);
}

function renderTripExpenses(trip) {
    const body = document.getElementById('trip-expenses-body');
    if (!body) { return; }
    body.innerHTML = '';
    if (!trip || !trip.expenses.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.textContent = 'Nincs közös költés.';
        row.appendChild(cell);
        body.appendChild(row);
        return;
    }
    trip.expenses.slice().reverse().forEach(expense => {
        const row = document.createElement('tr');
        [
            expense.date,
            expense.description || '-',
            formatCurrencyAmount(expense.amount, trip.currency),
            expense.paidBy,
            expense.splitBetween.join('; ')
        ].forEach((value, index) => {
            const cell = document.createElement('td');
            cell.textContent = value;
            if (index === 1 || index === 4) { cell.className = 'desc'; }
            row.appendChild(cell);
        });
        body.appendChild(row);
    });
}

function renderTrips() {
    if (!trips.length) { currentTripId = ''; }
    const trip = getCurrentTrip();
    if (trip && currentTripId !== trip.id) {
        currentTripId = trip.id;
        localStorage.setItem(STORAGE_CURRENT_TRIP, currentTripId);
    }
    renderTripSelect();
    renderTripPeople(trip);
    renderTripExpenseForm(trip);
    renderTripSummary(trip);
    renderTripExpenses(trip);
}

function createTrip() {
    const nameField = document.getElementById('trip-name');
    const currencyField = document.getElementById('trip-currency');
    const peopleField = document.getElementById('trip-people');
    const name = nameField.value.trim();
    const currency = currencyField.value.trim().toUpperCase();
    const people = normalizePeople(peopleField.value.split(','));
    if (!name) { alert('Add meg az utazás nevét!'); return; }
    if (!currency) { alert('Add meg a pénznemet!'); return; }
    if (people.length < 2) { alert('Adj meg legalább két résztvevőt vesszővel elválasztva.'); return; }
    if (trips.some(trip => trip.name.toLowerCase() === name.toLowerCase())) {
        alert('Ilyen nevű utazás már létezik.');
        return;
    }
    const trip = { id: generateId().replace('w_', 't_'), name, currency, people, expenses: [] };
    trips.push(trip);
    currentTripId = trip.id;
    persistTrips();
    localStorage.setItem(STORAGE_CURRENT_TRIP, currentTripId);
    nameField.value = '';
    currencyField.value = '';
    peopleField.value = '';
    renderTrips();
    showMessage('Utazás létrehozva.');
}

function addTripPerson() {
    const trip = getCurrentTrip();
    if (!trip) { alert('Előbb hozz létre egy utazást.'); return; }
    const field = document.getElementById('trip-new-person');
    const name = field.value.trim();
    if (!name) { alert('Add meg a résztvevő nevét!'); return; }
    if (trip.people.some(person => person.toLowerCase() === name.toLowerCase())) {
        alert('Ez a résztvevő már szerepel.');
        return;
    }
    trip.people.push(name);
    persistTrips();
    field.value = '';
    renderTrips();
    showMessage('Résztvevő hozzáadva.');
}

function addTripExpense() {
    const trip = getCurrentTrip();
    if (!trip) { alert('Előbb hozz létre egy utazást.'); return; }
    const dateField = document.getElementById('trip-date');
    const descField = document.getElementById('trip-description');
    const amountField = document.getElementById('trip-amount');
    const paidByField = document.getElementById('trip-paid-by');
    const amount = parsePositiveNumber(amountField.value);
    const splitBetween = Array.from(document.querySelectorAll('#trip-split-between input[type="checkbox"]:checked'))
        .map(input => input.value);
    if (amount === null) { alert('Add meg a pozitív összeget!'); return; }
    if (!paidByField.value) { alert('Válaszd ki, ki fizette.'); return; }
    if (!splitBetween.length) { alert('Válaszd ki, kik között oszlik meg.'); return; }
    trip.expenses.push({
        id: generateId().replace('w_', 'e_'),
        date: dateField.value || formatLocalDate(new Date()),
        description: descField.value.trim(),
        amount,
        paidBy: paidByField.value,
        splitBetween
    });
    persistTrips();
    descField.value = '';
    amountField.value = '';
    renderTrips();
    showMessage('Közös költés hozzáadva.');
}

function exportTripCSV() {
    const trip = getCurrentTrip();
    if (!trip) { alert('Nincs exportálható utazás.'); return; }
    const expenseLines = [
        'Expenses',
        'Trip,Date,Description,Amount,Currency,PaidBy,SplitBetween',
        ...trip.expenses.map(item => [
            csvEscape(trip.name),
            csvEscape(item.date),
            csvEscape(item.description),
            csvEscape(item.amount),
            csvEscape(trip.currency),
            csvEscape(item.paidBy),
            csvEscape(item.splitBetween.join(';'))
        ].join(','))
    ];
    const settlements = calculateTripSettlements(trip);
    const settlementLines = [
        '',
        'Settlement',
        'From,To,Amount,Currency',
        ...settlements.map(item => [
            csvEscape(item.from),
            csvEscape(item.to),
            csvEscape(item.amount),
            csvEscape(trip.currency)
        ].join(','))
    ];
    const csv = [...expenseLines, ...settlementLines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = trip.name.toLowerCase().replace(/[^a-z0-9áéíóöőúüű-]+/gi, '-').replace(/^-|-$/g, '') || 'utazas';
    a.href = url;
    a.download = `${safeName}-${trip.currency}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function setupTripEvents() {
    const select = document.getElementById('trip-select');
    if (select) { select.addEventListener('change', () => setCurrentTrip(select.value)); }
    const createForm = document.getElementById('trip-create-form');
    if (createForm) {
        createForm.addEventListener('submit', event => {
            event.preventDefault();
            createTrip();
        });
    }
    const personForm = document.getElementById('trip-person-form');
    if (personForm) {
        personForm.addEventListener('submit', event => {
            event.preventDefault();
            addTripPerson();
        });
    }
    const expenseForm = document.getElementById('trip-expense-form');
    if (expenseForm) {
        expenseForm.addEventListener('submit', event => {
            event.preventDefault();
            addTripExpense();
        });
    }
    const dateField = document.getElementById('trip-date');
    if (dateField && !dateField.value) { dateField.value = formatLocalDate(new Date()); }
}

let wallets = loadWallets();
let currentWalletId = loadCurrentWalletId(wallets);
let currentWallet = null;
let categories = [];
let data = [];
let trips = loadTrips();
let currentTripId = loadCurrentTripId(trips);
let expandedStats = {};
let editingExpenseId = '';

function setCurrentWallet(id) {
    if (!wallets.some(wallet => wallet.id === id)) { return; }
    currentWalletId = id;
    localStorage.setItem(STORAGE_CURRENT_WALLET, id);
    renderAll();
}

function formatLocalDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseLocalDate(dateStr) {
    if (typeof dateStr !== 'string') { return null; }
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) { return null; }
    const date = new Date(y, m - 1, d);
    if (Number.isNaN(date.getTime())) { return null; }
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) { return null; }
    return date;
}

function getWeekRange(today) {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const day = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - day);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    end.setDate(start.getDate() + 6);
    return { start, end };
}

function getMonthRange(today) {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { start, end };
}

function filterData(range) {
    return data.filter(item => {
        const date = parseLocalDate(item.date);
        return date && date >= range.start && date <= range.end;
    });
}

function sumExpenses(items) {
    return items.reduce((sum, item) => sum + (parseInt(item.amount, 10) || 0), 0);
}

function sumCategoryExpenses(items, categoryName) {
    return sumExpenses(items.filter(item => item.cat === categoryName));
}

function sumLimits(getLimit) {
    return categories.reduce((sum, cat) => sum + (getLimit(cat) || 0), 0);
}

function maxDate(a, b) {
    return a > b ? a : b;
}

function minDate(a, b) {
    return a < b ? a : b;
}

function intersectRanges(first, second) {
    const start = maxDate(first.start, second.start);
    const end = minDate(first.end, second.end);
    if (start > end) { return null; }
    return { start, end };
}

function countDaysInclusive(range) {
    if (!range) { return 0; }
    const msPerDay = 24 * 60 * 60 * 1000;
    const start = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate());
    const end = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate());
    return Math.round((end - start) / msPerDay) + 1;
}

function getBudgetAwareWeeklyLimit(cat, weekRange, monthRange) {
    const monthlyLimit = cat.monthlyLimit || 0;
    if (!monthlyLimit || !weekRange) { return 0; }

    const beforeWeekEnd = new Date(weekRange.start.getFullYear(), weekRange.start.getMonth(), weekRange.start.getDate());
    beforeWeekEnd.setDate(beforeWeekEnd.getDate() - 1);
    const beforeWeekRange = intersectRanges(monthRange, { start: monthRange.start, end: beforeWeekEnd });
    const spentBeforeWeek = beforeWeekRange ? sumCategoryExpenses(filterData(beforeWeekRange), cat.name) : 0;
    const remainingAtWeekStart = Math.max(0, monthlyLimit - spentBeforeWeek);
    const daysLeftFromWeekStart = countDaysInclusive({ start: weekRange.start, end: monthRange.end });
    const weekDays = countDaysInclusive(weekRange);

    if (!remainingAtWeekStart || !daysLeftFromWeekStart || !weekDays) { return 0; }
    return Math.round((remainingAtWeekStart / daysLeftFromWeekStart) * weekDays);
}

function vibrateSuccess() {
    if (navigator.vibrate) {
        navigator.vibrate(35);
    }
}

function appendSummaryCard(stats, filtered, getLimit, options = {}) {
    const spent = sumExpenses(filtered);
    const limit = sumLimits(getLimit);
    const remaining = limit - spent;
    const percent = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;

    const card = document.createElement('div');
    card.className = 'card stat-card summary-card';

    const title = document.createElement('strong');
    title.textContent = options.summaryTitle || 'Összesen';
    const amount = document.createElement('div');
    amount.className = `summary-amount${remaining < 0 ? ' negative-text' : ''}`;
    amount.textContent = `${formatFt(remaining)} maradt`;
    const meta = document.createElement('div');
    meta.className = 'stat-remaining';
    meta.textContent = `${formatFt(spent)} költés · ${formatFt(limit)} keret`;
    const extra = document.createElement('div');
    extra.className = 'summary-extra';
    extra.textContent = options.extraText || '';
    const barBg = document.createElement('div');
    barBg.className = 'bar-bg summary-bar';
    const barFill = document.createElement('div');
    barFill.className = `bar-fill${remaining < 0 ? ' negative' : ''}`;
    barFill.style.width = `${percent}%`;

    card.appendChild(title);
    card.appendChild(amount);
    card.appendChild(meta);
    if (options.extraText) { card.appendChild(extra); }
    barBg.appendChild(barFill);
    card.appendChild(barBg);
    stats.appendChild(card);
}

function appendExpenseDetails(stats, items, title, formatAmount = formatFt) {
    const panel = document.createElement('div');
    panel.className = 'card expense-details';

    const heading = document.createElement('strong');
    heading.textContent = title;
    panel.appendChild(heading);

    if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'period-label';
        empty.textContent = 'Nincs kiadás ebben a kategóriában.';
        panel.appendChild(empty);
        stats.appendChild(panel);
        return;
    }

    items.slice().reverse().forEach(item => {
        const row = document.createElement('div');
        row.className = 'expense-row';
        const meta = document.createElement('div');
        const note = document.createElement('strong');
        note.textContent = item.note || item.description || item.cat || 'Kiadás';
        const date = document.createElement('span');
        date.textContent = item.date;
        meta.appendChild(note);
        meta.appendChild(date);
        const amount = document.createElement('strong');
        amount.textContent = formatAmount(item.amount);
        row.appendChild(meta);
        row.appendChild(amount);
        panel.appendChild(row);
    });
    stats.appendChild(panel);
}

function renderStats(containerId, range, getLimit, options = {}) {
    const stats = document.getElementById(containerId);
    if (!stats) { return; }
    stats.innerHTML = '';
    const filtered = filterData(range);
    if (!categories.length) {
        const empty = document.createElement('div');
        empty.className = 'card';
        empty.textContent = 'Nincs kategória.';
        stats.appendChild(empty);
        return;
    }

    appendSummaryCard(stats, filtered, getLimit, options);

    categories.forEach(cat => {
        const categoryItems = filtered.filter(i => i.cat === cat.name);
        const spent = categoryItems.reduce((sum, i) => sum + (parseInt(i.amount, 10) || 0), 0);
        const limit = getLimit(cat);
        const remaining = limit - spent;
        const percent = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;

        const card = document.createElement('button');
        card.type = 'button';
        card.className = `card stat-card stat-button${expandedStats[containerId] === cat.name ? ' selected' : ''}`;
        card.addEventListener('click', () => {
            expandedStats[containerId] = expandedStats[containerId] === cat.name ? '' : cat.name;
            renderAll();
        });

        const title = document.createElement('strong');
        title.textContent = cat.name;
        const remainingEl = document.createElement('div');
        remainingEl.className = 'stat-remaining';
        remainingEl.textContent = `${formatFt(spent)} költés · ${formatFt(limit)} keret · ${formatFt(remaining)} maradt`;
        const barBg = document.createElement('div');
        barBg.className = 'bar-bg';
        const barFill = document.createElement('div');
        barFill.className = `bar-fill${remaining < 0 ? ' negative' : ''}`;
        barFill.style.width = `${percent}%`;

        barBg.appendChild(barFill);
        card.appendChild(title);
        card.appendChild(remainingEl);
        card.appendChild(barBg);
        stats.appendChild(card);

        if (expandedStats[containerId] === cat.name) {
            appendExpenseDetails(stats, categoryItems, cat.name);
        }
    });
}

function renderCategorySelect() {
    const select = document.getElementById('category-select');
    select.innerHTML = '';
    if (!categories.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Nincs kategória';
        select.appendChild(option);
        select.disabled = true;
        return;
    }
    select.disabled = false;
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Válassz kategóriát';
    placeholder.selected = true;
    placeholder.disabled = true;
    select.appendChild(placeholder);
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        select.appendChild(option);
    });
}

function renderSettings() {
    const list = document.getElementById('settings-list');
    list.innerHTML = '';
    if (!categories.length) {
        list.innerHTML = '<div class="card">Nincs kategória. Adj hozzá újat lent.</div>';
        updateSettingsTotal();
        return;
    }
    categories.forEach((cat, index) => {
        const row = document.createElement('div');
        row.className = 'card settings-row';
        const name = document.createElement('div');
        name.className = 'cat-name';
        name.textContent = cat.name;
        const monthlyInput = document.createElement('input');
        monthlyInput.type = 'number';
        monthlyInput.min = '0';
        monthlyInput.step = '1';
        monthlyInput.inputMode = 'numeric';
        monthlyInput.value = cat.monthlyLimit;
        monthlyInput.dataset.index = index;
        monthlyInput.dataset.type = 'monthly';
        monthlyInput.addEventListener('input', updateSettingsTotal);
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'delete-btn category-delete-btn';
        deleteButton.textContent = 'Törlés';
        deleteButton.addEventListener('click', () => deleteCategory(index));
        row.appendChild(name);
        row.appendChild(monthlyInput);
        row.appendChild(deleteButton);
        list.appendChild(row);
    });
    updateSettingsTotal();
}

function updateSettingsTotal() {
    const totalEl = document.getElementById('settings-total');
    if (!totalEl) { return; }
    const inputs = document.querySelectorAll('#settings-list input[data-type="monthly"]');
    const total = Array.from(inputs).reduce((sum, input) => {
        const value = parseNonNegativeInt(input.value);
        return sum + (value === null ? 0 : value);
    }, 0);
    totalEl.textContent = `Összesen: ${formatFt(total)}`;
}

function renderAll() {
    updateCurrentWallet();
    const today = new Date();
    const weekRange = getWeekRange(today);
    const monthRange = getMonthRange(today);
    const weekMonthRange = intersectRanges(weekRange, monthRange) || weekRange;
    const weekDays = countDaysInclusive(weekMonthRange);
    const remainingMonthDays = countDaysInclusive({ start: today, end: monthRange.end });
    document.getElementById('week-label').textContent = `${formatLocalDate(weekMonthRange.start)} – ${formatLocalDate(weekMonthRange.end)} · ${weekDays} nap ebből a hónapból`;
    document.getElementById('month-label').textContent = `${formatLocalDate(monthRange.start)} – ${formatLocalDate(monthRange.end)}`;
    renderStats(
        'stats-week',
        weekMonthRange,
        cat => getBudgetAwareWeeklyLimit(cat, weekMonthRange, monthRange),
        { summaryTitle: 'Heti összesen', extraText: `A havi maradék ${weekDays} napra leosztva` }
    );
    renderStats(
        'stats-month',
        monthRange,
        cat => cat.monthlyLimit || 0,
        { summaryTitle: 'Havi összesen', extraText: `${remainingMonthDays} nap van hátra a hónapból` }
    );
    renderExpenseTable('month-expenses', monthRange);
    renderCategorySelect();
    renderSettings();
    renderTrips();
}

function addExpense() {
    updateCurrentWallet();
    const amountField = document.getElementById('amount');
    const categoryField = document.getElementById('category-select');
    const noteField = document.getElementById('note');
    const amount = parseNonNegativeInt(amountField.value);
    if (amount === null || amount <= 0) { alert("Add meg az összeget!"); return; }
    const cat = categoryField.value;
    if (!cat) { alert("Válassz kategóriát!"); return; }
    const note = noteField.value.trim();
    currentWallet.expenses.push({ id: generateId().replace('w_', 'x_'), date: formatLocalDate(new Date()), cat, amount, note });
    persistWallets();
    amountField.value = '';
    noteField.value = '';
    categoryField.selectedIndex = 0;
    renderAll();
    vibrateSuccess();
    showMessage('Kiadás hozzáadva.');
}


function setupExpenseForm() {
    const form = document.getElementById('expense-form');
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        addExpense();
    });
    const toggle = document.getElementById('expense-toggle');
    if (toggle) {
        toggle.addEventListener('click', () => {
            form.classList.toggle('collapsed');
            const isCollapsed = form.classList.contains('collapsed');
            toggle.textContent = isCollapsed ? '+' : '×';
            toggle.setAttribute('aria-label', isCollapsed ? 'Új kiadás' : 'Kiadás bezárása');
            if (!isCollapsed) {
                form.scrollIntoView({ behavior: 'smooth', block: 'start' });
                window.setTimeout(() => document.getElementById('category-select')?.focus(), 250);
            }
        });
    }
}

function addCategory() {
    updateCurrentWallet();
    const nameField = document.getElementById('new-cat-name');
    const monthlyField = document.getElementById('new-cat-monthly');
    const name = nameField.value.trim();
    const monthlyLimit = parseNonNegativeInt(monthlyField.value);
    if (!name) { alert("Add meg a kategória nevét!"); return; }
    if (monthlyLimit === null) { alert("Adj meg 0 vagy annál nagyobb havi limitet!"); return; }
    if (categories.some(cat => cat.name === name)) { alert("Ez a kategória már létezik."); return; }
    currentWallet.categories.push({ name, monthlyLimit });
    persistWallets();
    nameField.value = '';
    monthlyField.value = '';
    renderAll();
}

function getSettingsValues() {
    let invalid = false;
    const updated = categories.map((cat, index) => {
        const monthlyInput = document.querySelector(`#settings-list input[data-index="${index}"][data-type="monthly"]`);
        const monthlyLimit = parseNonNegativeInt(monthlyInput?.value);
        if (monthlyLimit === null) { invalid = true; }
        return {
            ...cat,
            monthlyLimit: monthlyLimit === null ? 0 : monthlyLimit
        };
    });
    return { updated, invalid };
}

function showMessage(message) {
    const box = document.getElementById('message');
    if (!box) { alert(message); return; }
    box.textContent = message;
    box.classList.add('visible');
    window.clearTimeout(showMessage.timer);
    showMessage.timer = window.setTimeout(() => box.classList.remove('visible'), 2200);
}

function saveSettings() {
    updateCurrentWallet();
    const { updated, invalid } = getSettingsValues();
    if (invalid) { alert("Minden kategóriához adj meg 0 vagy annál nagyobb havi limitet."); return; }
    currentWallet.categories = updated;
    categories = updated;
    persistWallets();
    renderAll();
    showMessage("Beállítások mentve.");
}

function deleteCategory(index) {
    updateCurrentWallet();
    const { updated, invalid } = getSettingsValues();
    if (invalid) { alert("Törlés előtt javítsd a kategória limiteket."); return; }
    const category = updated[index];
    if (!category) { return; }
    const expenseCount = currentWallet.expenses.filter(expense => expense.cat === category.name).length;
    const baseMessage = expenseCount
        ? `A(z) "${category.name}" kategóriához ${expenseCount} kiadás tartozik. A kiadások megmaradnak, csak a kategória kerül ki a választható keretekből.`
        : `Biztos törlöd ezt a kategóriát?\n${category.name}`;
    if (!window.confirm(baseMessage)) { return; }
    if (expenseCount > 0) {
        const typed = window.prompt(`Megerősítéshez írd be pontosan: ${category.name}`);
        if (typed !== category.name) { return; }
    }
    currentWallet.categories = updated.filter((_, itemIndex) => itemIndex !== index);
    categories = currentWallet.categories;
    persistWallets();
    renderAll();
    showMessage('Kategória törölve.');
}

function deleteExpense(id) {
    updateCurrentWallet();
    const item = currentWallet.expenses.find(expense => expense.id === id);
    if (!item) { return; }
    const label = `${item.cat} · ${formatFt(item.amount)} · ${item.note || item.date}`;
    if (!window.confirm(`Biztos törlöd ezt a kiadást?\n${label}`)) { return; }
    currentWallet.expenses = currentWallet.expenses.filter(expense => expense.id !== id);
    if (editingExpenseId === id) { editingExpenseId = ''; }
    persistWallets();
    renderAll();
    showMessage('Kiadás törölve.');
}

function saveExpenseEdit(id) {
    updateCurrentWallet();
    const item = currentWallet.expenses.find(expense => expense.id === id);
    if (!item) { return; }
    const dateField = document.querySelector(`[data-edit-id="${id}"][data-field="date"]`);
    const catField = document.querySelector(`[data-edit-id="${id}"][data-field="cat"]`);
    const amountField = document.querySelector(`[data-edit-id="${id}"][data-field="amount"]`);
    const noteField = document.querySelector(`[data-edit-id="${id}"][data-field="note"]`);
    const date = dateField?.value || '';
    const amount = parseNonNegativeInt(amountField?.value);
    if (!parseLocalDate(date)) { alert('Adj meg érvényes dátumot!'); return; }
    if (!catField?.value) { alert('Válassz kategóriát!'); return; }
    if (amount === null || amount <= 0) { alert('Add meg az összeget!'); return; }
    item.date = date;
    item.cat = catField.value;
    item.amount = amount;
    item.note = noteField?.value.trim() || '';
    editingExpenseId = '';
    persistWallets();
    renderAll();
    vibrateSuccess();
    showMessage('Kiadás mentve.');
}

function renderExpenseEditForm(item) {
    const form = document.createElement('form');
    form.className = 'expense-edit-form';
    form.addEventListener('submit', event => {
        event.preventDefault();
        saveExpenseEdit(item.id);
    });

    const date = document.createElement('input');
    date.type = 'date';
    date.value = item.date;
    date.dataset.editId = item.id;
    date.dataset.field = 'date';

    const cat = document.createElement('select');
    cat.dataset.editId = item.id;
    cat.dataset.field = 'cat';
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.name;
        option.textContent = category.name;
        cat.appendChild(option);
    });
    if (!categories.some(category => category.name === item.cat)) {
        const option = document.createElement('option');
        option.value = item.cat;
        option.textContent = item.cat;
        cat.appendChild(option);
    }
    cat.value = item.cat;

    const amount = document.createElement('input');
    amount.type = 'number';
    amount.min = '1';
    amount.step = '1';
    amount.inputMode = 'numeric';
    amount.value = item.amount;
    amount.dataset.editId = item.id;
    amount.dataset.field = 'amount';

    const note = document.createElement('input');
    note.type = 'text';
    note.value = item.note || '';
    note.placeholder = 'Megjegyzés';
    note.dataset.editId = item.id;
    note.dataset.field = 'note';

    const actions = document.createElement('div');
    actions.className = 'edit-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'small-btn';
    cancel.textContent = 'Mégse';
    cancel.addEventListener('click', () => {
        editingExpenseId = '';
        renderAll();
    });
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'small-btn primary-small';
    save.textContent = 'Mentés';
    actions.appendChild(cancel);
    actions.appendChild(save);

    form.appendChild(cat);
    form.appendChild(amount);
    form.appendChild(note);
    form.appendChild(date);
    form.appendChild(actions);
    return form;
}

function csvEscape(value) {
    const str = value === undefined || value === null ? '' : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function formatExportDate(dateStr) {
    const date = parseLocalDate(dateStr) || new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}. ${m}. ${d}.`;
}

function resolveAcc(note) {
    return /revo/i.test(note || '') ? 'REVO' : 'OTP';
}

function getExportRows(scope = 'all') {
    if (scope === 'month') {
        return filterData(getMonthRange(new Date()));
    }
    return data;
}

function exportCSV(scope = 'all') {
    updateCurrentWallet();
    const rows = getExportRows(scope);
    const csv = "Category,Amount,Description,Date,Acc\n" + rows.map(i => {
        const note = i.note || '';
        return [
            csvEscape(i.cat),
            csvEscape(i.amount),
            csvEscape(note),
            csvEscape(formatExportDate(i.date)),
            csvEscape(resolveAcc(note))
        ].join(",");
    }).join("\n");

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const suffix = scope === 'month' ? formatLocalDate(new Date()).slice(0, 7) : 'osszes';
    a.href = url;
    a.download = `kiadasok-${suffix}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function renderExpenseTable(containerId, range) {
    const body = document.getElementById(containerId);
    if (!body) { return; }
    body.innerHTML = '';
    const filtered = filterData(range);
    if (!filtered.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 6;
        cell.textContent = 'Nincs adat.';
        row.appendChild(cell);
        body.appendChild(row);
        return;
    }
    filtered.slice().reverse().forEach(item => {
        const row = document.createElement('tr');
        const note = item.note || '';
        if (editingExpenseId === item.id) {
            const editCell = document.createElement('td');
            editCell.colSpan = 6;
            editCell.appendChild(renderExpenseEditForm(item));
            row.appendChild(editCell);
            body.appendChild(row);
            return;
        }
        [
            item.cat,
            item.amount,
            note,
            formatExportDate(item.date),
            resolveAcc(note)
        ].forEach((value, index) => {
            const cell = document.createElement('td');
            cell.textContent = value;
            if (index === 2) { cell.className = 'desc'; }
            row.appendChild(cell);
        });
        const actions = document.createElement('td');
        actions.className = 'table-actions';
        const actionButtons = document.createElement('div');
        actionButtons.className = 'table-action-buttons';
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'edit-btn';
        edit.textContent = 'Szerk.';
        edit.addEventListener('click', () => {
            editingExpenseId = item.id;
            renderAll();
        });
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'delete-btn';
        del.textContent = 'Törlés';
        del.addEventListener('click', () => deleteExpense(item.id));
        actionButtons.appendChild(edit);
        actionButtons.appendChild(del);
        actions.appendChild(actionButtons);
        row.appendChild(actions);
        body.appendChild(row);
    });
}

function switchView(view) {
    const allowed = ['week', 'month', 'settings', 'trips'];
    const nextView = allowed.includes(view) ? view : 'week';
    document.querySelectorAll('.view').forEach(section => section.classList.remove('active'));
    const active = document.getElementById(`view-${nextView}`);
    if (active) { active.classList.add('active'); }
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === nextView);
    });
    if (location.hash !== `#${nextView}`) {
        history.replaceState(null, '', `#${nextView}`);
    }
    const expenseToggle = document.getElementById('expense-toggle');
    if (expenseToggle) {
        expenseToggle.classList.toggle('hidden', nextView !== 'week');
    }
}

function setupSettingsEvents() {
    document.getElementById('category-add')?.addEventListener('click', addCategory);
    document.getElementById('settings-save')?.addEventListener('click', saveSettings);
    document.getElementById('export-month')?.addEventListener('click', () => exportCSV('month'));
    document.getElementById('export-all')?.addEventListener('click', () => exportCSV('all'));
    document.getElementById('trips-open')?.addEventListener('click', () => switchView('trips'));
}

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
});

setupExpenseForm();
setupTripEvents();
setupSettingsEvents();
const initialView = location.hash.replace('#', '');
switchView(initialView);
renderAll();
