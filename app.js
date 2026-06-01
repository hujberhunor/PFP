const STORAGE_WALLETS = 'wallets';
const STORAGE_CURRENT_WALLET = 'currentWalletId';
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

function generateId() {
    return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeCategories(list) {
    if (!Array.isArray(list)) { return []; }
    return list.map(item => {
        const monthlyRaw = parseInt(item.monthlyLimit, 10);
        const weeklyRaw = parseInt(item.weeklyLimit, 10);
        const legacyRaw = parseInt(item.limit, 10);
        const monthlyLimit = Number.isFinite(monthlyRaw)
            ? monthlyRaw
            : (Number.isFinite(weeklyRaw) ? weeklyRaw * 4 : (Number.isFinite(legacyRaw) ? legacyRaw * 4 : 0));
        return { name: item.name, monthlyLimit };
    }).filter(item => item.name);
}

function loadLegacyCategories() {
    const saved = JSON.parse(localStorage.getItem('categories'));
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
        const nextCat = categoryAliases[item.cat];
        if (nextCat && nextCat !== item.cat) {
            changed = true;
            return { ...item, cat: nextCat };
        }
        return item;
    });
    return { normalized, changed };
}

function normalizeWallet(raw) {
    const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : DEFAULT_WALLET_NAME;
    const id = raw.id || generateId();
    const categories = normalizeCategories(raw.categories || []);
    const fallbackCategories = categories.length ? categories : defaultCategories.map(cat => ({ ...cat }));
    const expensesRaw = Array.isArray(raw.expenses) ? raw.expenses : [];
    const { normalized, changed } = normalizeExpenses(expensesRaw);
    return { wallet: { id, name, categories: fallbackCategories, expenses: normalized }, changed };
}

function loadWallets() {
    const saved = JSON.parse(localStorage.getItem(STORAGE_WALLETS));
    if (Array.isArray(saved) && saved.length) {
        let changed = false;
        const wallets = saved.map(raw => {
            const result = normalizeWallet(raw);
            if (result.changed) { changed = true; }
            return result.wallet;
        });
        if (changed) {
            localStorage.setItem(STORAGE_WALLETS, JSON.stringify(wallets));
        }
        return wallets;
    }
    const legacyCategories = loadLegacyCategories();
    const legacyExpenses = JSON.parse(localStorage.getItem('expenses')) || [];
    const result = normalizeWallet({
        id: generateId(),
        name: DEFAULT_WALLET_NAME,
        categories: legacyCategories,
        expenses: legacyExpenses
    });
    const wallets = [result.wallet];
    localStorage.setItem(STORAGE_WALLETS, JSON.stringify(wallets));
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
    localStorage.setItem(STORAGE_WALLETS, JSON.stringify(wallets));
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

let wallets = loadWallets();
let currentWalletId = loadCurrentWalletId(wallets);
let currentWallet = null;
let categories = [];
let data = [];

function renderWalletSelect() {
    const select = document.getElementById('wallet-select');
    if (!select) { return; }
    select.innerHTML = '';
    wallets.forEach(wallet => {
        const option = document.createElement('option');
        option.value = wallet.id;
        option.textContent = wallet.name;
        select.appendChild(option);
    });
    select.value = currentWalletId;
}

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
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
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
        return date >= range.start && date <= range.end;
    });
}

function getWeeklyLimit(monthRange, monthlyLimit) {
    if (!monthlyLimit) { return 0; }
    const daysInMonth = monthRange.end.getDate();
    return Math.round((monthlyLimit / daysInMonth) * 7);
}

function renderStats(containerId, range, getLimit) {
    const stats = document.getElementById(containerId);
    stats.innerHTML = '';
    const filtered = filterData(range);
    if (!categories.length) {
        stats.innerHTML = '<div class="card">Nincs kategória.</div>';
        return;
    }
    categories.forEach(cat => {
        const spent = filtered.filter(i => i.cat === cat.name).reduce((sum, i) => sum + parseInt(i.amount, 10), 0);
        const limit = getLimit(cat);
        const remaining = limit - spent;
        const percent = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
        stats.innerHTML += `
            <div class="card stat-card">
                <strong>${cat.name}</strong>
                <div class="stat-remaining">${remaining} Ft maradt</div>
                <div class="bar-bg"><div class="bar-fill ${remaining < 0 ? 'negative' : ''}" style="width: ${percent}%"></div></div>
            </div>`;
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
        monthlyInput.value = cat.monthlyLimit;
        monthlyInput.dataset.index = index;
        monthlyInput.dataset.type = 'monthly';
        monthlyInput.addEventListener('input', updateSettingsTotal);
        row.appendChild(name);
        row.appendChild(monthlyInput);
        list.appendChild(row);
    });
    updateSettingsTotal();
}

function updateSettingsTotal() {
    const totalEl = document.getElementById('settings-total');
    if (!totalEl) { return; }
    const inputs = document.querySelectorAll('#settings-list input[data-type="monthly"]');
    const total = Array.from(inputs).reduce((sum, input) => {
        const value = parseInt(input.value, 10);
        return sum + (isNaN(value) ? 0 : value);
    }, 0);
    totalEl.textContent = `Összes havi limit: ${total} Ft`;
}

function renderAll() {
    updateCurrentWallet();
    const today = new Date();
    const weekRange = getWeekRange(today);
    const monthRange = getMonthRange(today);
    document.getElementById('week-label').textContent = `${formatLocalDate(weekRange.start)} – ${formatLocalDate(weekRange.end)}`;
    document.getElementById('month-label').textContent = `${formatLocalDate(monthRange.start)} – ${formatLocalDate(monthRange.end)}`;
    renderStats('stats-week', weekRange, cat => getWeeklyLimit(monthRange, cat.monthlyLimit));
    renderStats('stats-month', monthRange, cat => cat.monthlyLimit || 0);
    renderMonthTable(monthRange);
    renderCategorySelect();
    renderSettings();
    renderWalletSelect();
}

function addExpense() {
    updateCurrentWallet();
    const amountField = document.getElementById('amount');
    const categoryField = document.getElementById('category-select');
    const noteField = document.getElementById('note');
    const amount = parseInt(amountField.value, 10);
    if (isNaN(amount) || amount <= 0) { alert("Add meg az összeget!"); return; }
    const cat = categoryField.value;
    if (!cat) { alert("Válassz kategóriát!"); return; }
    const note = noteField.value.trim();
    currentWallet.expenses.push({ date: formatLocalDate(new Date()), cat, amount, note });
    persistWallets();
    amountField.value = '';
    noteField.value = '';
    categoryField.selectedIndex = 0;
    renderAll();
    categoryField.focus();
}

function setupExpenseForm() {
    const form = document.getElementById('expense-form');
    const amountField = document.getElementById('amount');
    const categoryField = document.getElementById('category-select');

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        addExpense();
    });

    categoryField.addEventListener('change', () => {
        amountField.focus();
    });
}

function setupWalletSelect() {
    const select = document.getElementById('wallet-select');
    if (!select) { return; }
    select.addEventListener('change', () => setCurrentWallet(select.value));
}

function addWallet() {
    updateCurrentWallet();
    const nameField = document.getElementById('new-wallet-name');
    const name = nameField.value.trim();
    if (!name) { alert("Add meg a tárca nevét!"); return; }
    if (wallets.some(wallet => wallet.name.toLowerCase() === name.toLowerCase())) {
        alert("Ez a tárca már létezik.");
        return;
    }
    const baseCategories = (categories.length ? categories : defaultCategories).map(cat => ({ ...cat }));
    const wallet = { id: generateId(), name, categories: baseCategories, expenses: [] };
    wallets.push(wallet);
    persistWallets();
    nameField.value = '';
    setCurrentWallet(wallet.id);
}

function addCategory() {
    updateCurrentWallet();
    const nameField = document.getElementById('new-cat-name');
    const monthlyField = document.getElementById('new-cat-monthly');
    const name = nameField.value.trim();
    const monthlyLimit = parseInt(monthlyField.value, 10);
    if (!name) { alert("Add meg a kategória nevét!"); return; }
    if (isNaN(monthlyLimit)) { alert("Add meg a havi limitet!"); return; }
    if (categories.some(cat => cat.name === name)) { alert("Ez a kategória már létezik."); return; }
    currentWallet.categories.push({ name, monthlyLimit });
    persistWallets();
    nameField.value = '';
    monthlyField.value = '';
    renderAll();
}

function saveSettings() {
    updateCurrentWallet();
    let invalid = false;
    const updated = categories.map((cat, index) => {
        const monthlyInput = document.querySelector(`#settings-list input[data-index="${index}"][data-type="monthly"]`);
        const monthlyLimit = parseInt(monthlyInput.value, 10);
        if (isNaN(monthlyLimit)) {
            invalid = true;
        }
        return {
            ...cat,
            monthlyLimit: isNaN(monthlyLimit) ? 0 : monthlyLimit
        };
    });
    if (invalid) { alert("Minden kategóriához adj meg havi limitet."); return; }
    currentWallet.categories = updated;
    categories = updated;
    persistWallets();
    renderAll();
    alert("Beállítások mentve.");
}

function csvEscape(value) {
    const str = value === undefined || value === null ? '' : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function formatExportDate(dateStr) {
    const date = parseLocalDate(dateStr);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}. ${m}. ${d}.`;
}

function resolveAcc(note) {
    return /revo/i.test(note || '') ? 'REVO' : 'OTP';
}

function exportCSV() {
    updateCurrentWallet();
    let csv = "Category,Amount,Description,Date,Acc\n" + data.map(i => {
        const note = i.note || '';
        return [
            csvEscape(i.cat),
            csvEscape(i.amount),
            csvEscape(note),
            csvEscape(formatExportDate(i.date)),
            csvEscape(resolveAcc(note))
        ].join(",");
    }).join("\n");
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
    a.download = 'kiadasok.csv';
    a.click();
}

function renderMonthTable(range) {
    const body = document.getElementById('month-raw');
    body.innerHTML = '';
    const filtered = filterData(range);
    if (!filtered.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.textContent = 'Nincs adat.';
        row.appendChild(cell);
        body.appendChild(row);
        return;
    }
    filtered.forEach(item => {
        const row = document.createElement('tr');
        const note = item.note || '';
        const cells = [
            item.cat,
            item.amount,
            note,
            formatExportDate(item.date),
            resolveAcc(note)
        ];
        cells.forEach((value, index) => {
            const cell = document.createElement('td');
            cell.textContent = value;
            if (index === 2) {
                cell.className = 'desc';
            }
            row.appendChild(cell);
        });
        body.appendChild(row);
    });
}

function switchView(view) {
    const allowed = ['week', 'month', 'settings'];
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
}

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
});

setupExpenseForm();
setupWalletSelect();
const initialView = location.hash.replace('#', '');
switchView(initialView);
renderAll();
