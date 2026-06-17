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


function parseOptionalPositiveNumber(value) {
    if (value === undefined || value === null || value === '') { return null; }
    return parsePositiveNumber(value);
}

function normalizeCurrency(value, fallback = 'HUF') {
    const currency = typeof value === 'string' ? value.trim().toUpperCase() : '';
    return currency || fallback;
}

function normalizeTripExpense(item, baseCurrency) {
    const source = item && typeof item === 'object' ? item : {};
    const amount = parsePositiveNumber(source.amount);
    const currency = normalizeCurrency(source.currency, baseCurrency);
    return {
        id: source.id || generateId().replace('w_', 'e_'),
        date: typeof source.date === 'string' ? source.date : formatLocalDate(new Date()),
        description: typeof source.description === 'string' ? source.description.trim() : '',
        amount: amount || 0,
        currency,
        category: typeof source.category === 'string' ? source.category.trim() : '',
        note: typeof source.note === 'string' ? source.note.trim() : ''
    };
}

function normalizeTrip(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const baseCurrency = normalizeCurrency(source.baseCurrency || source.currency, 'HUF');
    const expenses = (Array.isArray(source.expenses) ? source.expenses : [])
        .map(item => normalizeTripExpense(item, baseCurrency))
        .filter(item => item.amount > 0);
    return {
        id: source.id || generateId().replace('w_', 't_'),
        name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : 'Utazás',
        baseCurrency,
        budget: parseOptionalPositiveNumber(source.budget) || 0,
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
        option.textContent = `${trip.name} · ${trip.baseCurrency}`;
        select.appendChild(option);
    });
    select.value = currentTripId;
}

function renderTripExpenseForm(trip) {
    const form = document.getElementById('trip-expense-form');
    if (!form) { return; }
    const enabled = Boolean(trip);
    form.classList.toggle('disabled-block', !enabled);
    form.querySelectorAll('input, select, button').forEach(el => { el.disabled = !enabled; });
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
    const remaining = trip.budget > 0 ? trip.budget - total : null;
    const totalCard = document.createElement('div');
    totalCard.className = 'card summary-card';
    const title = document.createElement('strong');
    title.textContent = trip.name;
    const amount = document.createElement('div');
    amount.className = `summary-amount${remaining !== null && remaining < 0 ? ' negative-text' : ''}`;
    amount.textContent = remaining !== null
        ? `${formatCurrencyAmount(remaining, trip.baseCurrency)} maradt`
        : `${formatCurrencyAmount(total, trip.baseCurrency)} költés`;
    const meta = document.createElement('div');
    meta.className = 'stat-remaining';
    meta.textContent = trip.budget > 0
        ? `${formatCurrencyAmount(total, trip.baseCurrency)} költés · ${formatCurrencyAmount(trip.budget, trip.baseCurrency)} keret`
        : `${trip.baseCurrency} tárca · nincs megadott keret`;
    totalCard.appendChild(title);
    totalCard.appendChild(amount);
    totalCard.appendChild(meta);
    box.appendChild(totalCard);
}

function renderTripExpenses(trip) {
    const body = document.getElementById('trip-expenses-body');
    if (!body) { return; }
    body.innerHTML = '';
    if (!trip || !trip.expenses.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 6;
        cell.textContent = 'Nincs utazós költés.';
        row.appendChild(cell);
        body.appendChild(row);
        return;
    }
    trip.expenses.slice().reverse().forEach(expense => {
        const row = document.createElement('tr');
        if (editingTripExpenseId === expense.id) {
            const editCell = document.createElement('td');
            editCell.colSpan = 6;
            editCell.appendChild(renderTripExpenseEditForm(trip, expense));
            row.appendChild(editCell);
            body.appendChild(row);
            return;
        }
        [
            expense.date,
            expense.category || '-',
            expense.amount,
            expense.currency,
            expense.note || '-'
        ].forEach((value, index) => {
            const cell = document.createElement('td');
            cell.textContent = value;
            if (index === 4) { cell.className = 'desc'; }
            row.appendChild(cell);
        });
        const actions = document.createElement('td');
        actions.className = 'table-actions';
        const buttons = document.createElement('div');
        buttons.className = 'table-action-buttons';
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'edit-btn';
        edit.textContent = 'Szerk.';
        edit.addEventListener('click', () => {
            editingTripExpenseId = expense.id;
            renderTrips();
        });
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'delete-btn';
        del.textContent = 'Törlés';
        del.addEventListener('click', () => deleteTripExpense(expense.id));
        buttons.appendChild(edit);
        buttons.appendChild(del);
        actions.appendChild(buttons);
        row.appendChild(actions);
        body.appendChild(row);
    });
}

function renderTripExpenseEditForm(trip, expense) {
    const form = document.createElement('form');
    form.className = 'expense-edit-form';
    form.addEventListener('submit', event => {
        event.preventDefault();
        saveTripExpenseEdit(expense.id);
    });

    const date = document.createElement('input');
    date.type = 'date';
    date.value = expense.date;
    date.dataset.tripEditId = expense.id;
    date.dataset.field = 'date';

    const category = document.createElement('select');
    category.dataset.tripEditId = expense.id;
    category.dataset.field = 'category';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        category.appendChild(option);
    });
    if (expense.category && !categories.some(cat => cat.name === expense.category)) {
        const option = document.createElement('option');
        option.value = expense.category;
        option.textContent = expense.category;
        category.appendChild(option);
    }
    category.value = expense.category || categories[0]?.name || '';

    const amount = document.createElement('input');
    amount.type = 'number';
    amount.min = '0.01';
    amount.step = '0.01';
    amount.inputMode = 'decimal';
    amount.value = expense.amount;
    amount.dataset.tripEditId = expense.id;
    amount.dataset.field = 'amount';

    const currency = document.createElement('input');
    currency.type = 'text';
    currency.maxLength = 6;
    currency.value = expense.currency || trip.baseCurrency;
    currency.dataset.tripEditId = expense.id;
    currency.dataset.field = 'currency';

    const note = document.createElement('input');
    note.type = 'text';
    note.value = expense.note || '';
    note.placeholder = 'Megjegyzés';
    note.dataset.tripEditId = expense.id;
    note.dataset.field = 'note';

    const actions = document.createElement('div');
    actions.className = 'edit-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'small-btn';
    cancel.textContent = 'Mégse';
    cancel.addEventListener('click', () => {
        editingTripExpenseId = '';
        renderTrips();
    });
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'small-btn primary-small';
    save.textContent = 'Mentés';
    actions.appendChild(cancel);
    actions.appendChild(save);

    [category, amount, note, currency, date, actions].forEach(el => form.appendChild(el));
    return form;
}

function renderTrips() {
    if (!trips.length) { currentTripId = ''; }
    const trip = getCurrentTrip();
    if (trip && currentTripId !== trip.id) {
        currentTripId = trip.id;
        localStorage.setItem(STORAGE_CURRENT_TRIP, currentTripId);
    }
    renderTripSelect();
    populateCategorySelect(document.getElementById('trip-category'), { placeholder: 'Válassz kategóriát' });
    renderTripExpenseForm(trip);
    renderTripSummary(trip);
    renderTripExpenses(trip);
}

function createTrip() {
    const nameField = document.getElementById('trip-name');
    const currencyField = document.getElementById('trip-currency');
    const budgetField = document.getElementById('trip-budget');
    if (!nameField || !currencyField) { return; }
    const name = nameField.value.trim();
    const baseCurrency = normalizeCurrency(currencyField.value, 'HUF');
    const budget = parseOptionalPositiveNumber(budgetField?.value) || 0;
    if (!name) { alert('Add meg az utazás nevét!'); return; }
    if (trips.some(trip => trip.name.toLowerCase() === name.toLowerCase())) {
        alert('Ilyen nevű tárca már létezik.');
        return;
    }
    const trip = { id: generateId().replace('w_', 't_'), name, baseCurrency, budget, expenses: [] };
    trips.push(trip);
    currentTripId = trip.id;
    persistTrips();
    localStorage.setItem(STORAGE_CURRENT_TRIP, currentTripId);
    nameField.value = '';
    currencyField.value = '';
    if (budgetField) { budgetField.value = ''; }
    document.getElementById('trip-create-panel')?.removeAttribute('open');
    renderTrips();
    showMessage('Tárca létrehozva.');
}

function addTripExpense() {
    const trip = getCurrentTrip();
    if (!trip) { alert('Előbb hozz létre egy utazást.'); return; }
    const dateField = document.getElementById('trip-date');
    const amountField = document.getElementById('trip-amount');
    const currencyField = document.getElementById('trip-expense-currency');
    const categoryField = document.getElementById('trip-category');
    const noteField = document.getElementById('trip-note');
    const amount = parsePositiveNumber(amountField.value);
    const currency = normalizeCurrency(currencyField.value, trip.baseCurrency);
    if (amount === null) { alert('Add meg a pozitív összeget!'); return; }
    const category = categoryField.value;
    if (!category) { alert('Adj meg kategóriát!'); return; }
    trip.expenses.push({
        id: generateId().replace('w_', 'e_'),
        date: dateField.value || formatLocalDate(new Date()),
        description: noteField.value.trim(),
        amount,
        currency,
        category,
        note: noteField.value.trim()
    });
    persistTrips();
    amountField.value = '';
    categoryField.value = '';
    noteField.value = '';
    currencyField.value = '';
    renderTrips();
    vibrateSuccess();
    showMessage('Utazós költés hozzáadva.');
}

function getTripExpenseField(id, field) {
    return document.querySelector(`[data-trip-edit-id="${id}"][data-field="${field}"]`);
}

function saveTripExpenseEdit(id) {
    const trip = getCurrentTrip();
    if (!trip) { return; }
    const expense = trip.expenses.find(item => item.id === id);
    if (!expense) { return; }
    const amount = parsePositiveNumber(getTripExpenseField(id, 'amount')?.value);
    const date = getTripExpenseField(id, 'date')?.value || '';
    if (!parseLocalDate(date)) { alert('Adj meg érvényes dátumot!'); return; }
    if (amount === null) { alert('Add meg a pozitív összeget!'); return; }
    const category = getTripExpenseField(id, 'category')?.value || '';
    if (!category) { alert('Adj meg kategóriát!'); return; }
    expense.date = date;
    expense.description = getTripExpenseField(id, 'note')?.value.trim() || '';
    expense.amount = amount;
    expense.currency = normalizeCurrency(getTripExpenseField(id, 'currency')?.value, trip.baseCurrency);
    expense.category = category;
    expense.note = getTripExpenseField(id, 'note')?.value.trim() || '';
    editingTripExpenseId = '';
    persistTrips();
    renderTrips();
    vibrateSuccess();
    showMessage('Utazós költés mentve.');
}

function deleteTripExpense(id) {
    const trip = getCurrentTrip();
    if (!trip) { return; }
    const expense = trip.expenses.find(item => item.id === id);
    if (!expense) { return; }
    const label = `${expense.description || 'Költés'} · ${formatCurrencyAmount(expense.amount, expense.currency)}`;
    if (!window.confirm(`Biztos törlöd ezt az utazós költést?\n${label}`)) { return; }
    trip.expenses = trip.expenses.filter(item => item.id !== id);
    if (editingTripExpenseId === id) { editingTripExpenseId = ''; }
    persistTrips();
    renderTrips();
    showMessage('Utazós költés törölve.');
}

function exportTripCSV() {
    const trip = getCurrentTrip();
    if (!trip) { alert('Nincs exportálható utazás.'); return; }
    const expenseLines = [
        'Expenses',
        'Trip,Date,Category,Amount,Currency,Note',
        ...trip.expenses.map(item => [
            csvEscape(trip.name),
            csvEscape(item.date),
            csvEscape(item.category),
            csvEscape(item.amount),
            csvEscape(item.currency),
            csvEscape(item.note)
        ].join(','))
    ];
    const csv = expenseLines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = trip.name.toLowerCase().replace(/[^a-z0-9áéíóöőúüű-]+/gi, '-').replace(/^-|-$/g, '') || 'utazas';
    a.href = url;
    a.download = `${safeName}-${trip.baseCurrency}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function setupTripEvents() {
    const select = document.getElementById('trip-select');
    if (select) { select.addEventListener('change', () => setCurrentTrip(select.value)); }
    document.getElementById('trip-create-submit')?.addEventListener('click', createTrip);
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
let editingTripExpenseId = '';

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

function populateCategorySelect(select, options = {}) {
    if (!select) { return; }
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
    if (options.placeholder) {
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = options.placeholder;
        placeholder.selected = !options.value;
        placeholder.disabled = true;
        select.appendChild(placeholder);
    }
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        select.appendChild(option);
    });
    if (options.value) { select.value = options.value; }
}

function renderCategorySelect() {
    populateCategorySelect(document.getElementById('category-select'), { placeholder: 'Válassz kategóriát' });
    populateCategorySelect(document.getElementById('trip-category'), { placeholder: 'Válassz kategóriát' });
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
    function toggleForm(targetForm, focusSelector, openLabel, closeLabel) {
        targetForm.classList.toggle('collapsed');
        const isCollapsed = targetForm.classList.contains('collapsed');
        const toggle = document.getElementById('expense-toggle');
        if (toggle) {
            toggle.textContent = isCollapsed ? '+' : '×';
            toggle.setAttribute('aria-label', isCollapsed ? openLabel : closeLabel);
        }
        if (!isCollapsed) {
            targetForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            window.setTimeout(() => document.querySelector(focusSelector)?.focus(), 250);
        }
    }
    const toggle = document.getElementById('expense-toggle');
    if (toggle) {
        toggle.addEventListener('click', () => {
            if (document.getElementById('view-trips')?.classList.contains('active')) {
                const tripForm = document.getElementById('trip-expense-form');
                if (tripForm) {
                    toggleForm(tripForm, '#trip-category', 'Új utazós költés', 'Utazós költés bezárása');
                }
                return;
            }
            toggleForm(form, '#category-select', 'Új kiadás', 'Kiadás bezárása');
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

function parseCSV(text) {
    const rows = [];
    let row = [];
    let value = '';
    let inQuotes = false;
    const input = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < input.length; i += 1) {
        const char = input[i];
        const next = input[i + 1];
        if (char === '"') {
            if (inQuotes && next === '"') {
                value += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            row.push(value);
            value = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && next === '\n') { i += 1; }
            row.push(value);
            if (row.some(cell => cell !== '')) { rows.push(row); }
            row = [];
            value = '';
        } else {
            value += char;
        }
    }
    row.push(value);
    if (row.some(cell => cell !== '')) { rows.push(row); }
    return rows;
}

function normalizeCSVHeader(value) {
    return String(value || '').trim().toLowerCase();
}

function parseImportDate(value) {
    const raw = String(value || '').trim();
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso && parseLocalDate(raw)) { return raw; }
    const dotted = raw.match(/^(\d{4})\.\s*(\d{2})\.\s*(\d{2})\.?$/);
    if (dotted) {
        const formatted = `${dotted[1]}-${dotted[2]}-${dotted[3]}`;
        if (parseLocalDate(formatted)) { return formatted; }
    }
    return null;
}

function importMainCSVRows(rows) {
    if (rows.length < 2) { return 0; }
    updateCurrentWallet();
    const headers = rows[0].map(normalizeCSVHeader);
    const indexOf = name => headers.indexOf(name);
    const dateIndex = indexOf('date');
    const amountIndex = indexOf('amount');
    const categoryIndex = indexOf('category');
    const descriptionIndex = indexOf('description');
    const walletIndex = indexOf('wallet');
    const idIndex = indexOf('id');
    if (dateIndex < 0 || amountIndex < 0 || categoryIndex < 0) { return 0; }

    const existingIds = new Set(currentWallet.expenses.map(item => item.id).filter(Boolean));
    let imported = 0;
    rows.slice(1).forEach(row => {
        const wallet = walletIndex >= 0 ? String(row[walletIndex] || '').trim().toLowerCase() : 'main';
        if (wallet && wallet !== 'main' && wallet !== currentWallet.name.toLowerCase()) { return; }
        const date = parseImportDate(row[dateIndex]);
        const amount = parseNonNegativeInt(row[amountIndex]);
        const cat = String(row[categoryIndex] || '').trim();
        if (!date || !amount || !cat) { return; }
        const importedId = idIndex >= 0 ? String(row[idIndex] || '').trim() : '';
        if (importedId && existingIds.has(importedId)) { return; }
        const id = importedId || generateId().replace('w_', 'x_');
        existingIds.add(id);
        currentWallet.expenses.push({
            id,
            date,
            cat,
            amount,
            note: descriptionIndex >= 0 ? String(row[descriptionIndex] || '').trim() : ''
        });
        imported += 1;
    });
    if (imported > 0) {
        persistWallets();
        renderAll();
    }
    return imported;
}

function importCSVFile(file) {
    if (!file) { return; }
    const reader = new FileReader();
    reader.addEventListener('load', () => {
        const rows = parseCSV(String(reader.result || ''));
        const imported = importMainCSVRows(rows);
        showMessage(imported > 0 ? `${imported} sor importálva.` : 'Nem volt importálható sor.');
        const input = document.getElementById('csv-import-file');
        if (input) { input.value = ''; }
    });
    reader.readAsText(file);
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
        expenseToggle.classList.toggle('hidden', !['week', 'trips'].includes(nextView));
        expenseToggle.textContent = '+';
        expenseToggle.setAttribute('aria-label', nextView === 'trips' ? 'Új utazós költés' : 'Új kiadás');
    }
}

function setupSettingsEvents() {
    document.getElementById('category-add')?.addEventListener('click', addCategory);
    document.getElementById('settings-save')?.addEventListener('click', saveSettings);
    document.getElementById('export-month')?.addEventListener('click', () => exportCSV('month'));
    document.getElementById('export-all')?.addEventListener('click', () => exportCSV('all'));
    document.getElementById('trips-open')?.addEventListener('click', () => switchView('trips'));
    document.getElementById('csv-import-file')?.addEventListener('change', event => {
        importCSVFile(event.target.files?.[0]);
    });
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
