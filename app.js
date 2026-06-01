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

function loadCategories() {
    const saved = JSON.parse(localStorage.getItem('categories'));
    if (Array.isArray(saved) && saved.length) {
        return saved.map(item => {
            const monthlyRaw = parseInt(item.monthlyLimit, 10);
            const weeklyRaw = parseInt(item.weeklyLimit, 10);
            const legacyRaw = parseInt(item.limit, 10);
            const monthlyLimit = Number.isFinite(monthlyRaw)
                ? monthlyRaw
                : (Number.isFinite(weeklyRaw) ? weeklyRaw * 4 : (Number.isFinite(legacyRaw) ? legacyRaw * 4 : 0));
            return { name: item.name, monthlyLimit };
        });
    }
    if (saved && typeof saved === 'object') {
        return Object.keys(saved).map(name => {
            const legacy = parseInt(saved[name], 10);
            return { name, monthlyLimit: Number.isFinite(legacy) ? legacy * 4 : 0 };
        });
    }
    return defaultCategories;
}

function saveCategories() {
    localStorage.setItem('categories', JSON.stringify(categories));
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

let categories = loadCategories();
let data = JSON.parse(localStorage.getItem('expenses')) || [];
const categoryAliases = {
    '🍪 Édesség': '🍪 Édesség/Üdítő'
};
let dataChanged = false;
data = data.map(item => {
    const nextCat = categoryAliases[item.cat];
    if (nextCat && nextCat !== item.cat) {
        dataChanged = true;
        return { ...item, cat: nextCat };
    }
    return item;
});
if (dataChanged) {
    localStorage.setItem('expenses', JSON.stringify(data));
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
        row.appendChild(name);
        row.appendChild(monthlyInput);
        list.appendChild(row);
    });
}

function renderAll() {
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
}

function addExpense() {
    const amountField = document.getElementById('amount');
    const categoryField = document.getElementById('category-select');
    const noteField = document.getElementById('note');
    const amount = parseInt(amountField.value, 10);
    if (isNaN(amount) || amount <= 0) { alert("Add meg az összeget!"); return; }
    const cat = categoryField.value;
    if (!cat) { alert("Válassz kategóriát!"); return; }
    const note = noteField.value.trim();
    data.push({ date: formatLocalDate(new Date()), cat, amount, note });
    localStorage.setItem('expenses', JSON.stringify(data));
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
    const noteField = document.getElementById('note');

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        addExpense();
    });

    categoryField.addEventListener('change', () => {
        amountField.focus();
    });

    categoryField.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            amountField.focus();
        }
    });

    amountField.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            noteField.focus();
        }
    });

    noteField.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addExpense();
        }
    });
}

function addCategory() {
    const nameField = document.getElementById('new-cat-name');
    const monthlyField = document.getElementById('new-cat-monthly');
    const name = nameField.value.trim();
    const monthlyLimit = parseInt(monthlyField.value, 10);
    if (!name) { alert("Add meg a kategória nevét!"); return; }
    if (isNaN(monthlyLimit)) { alert("Add meg a havi limitet!"); return; }
    if (categories.some(cat => cat.name === name)) { alert("Ez a kategória már létezik."); return; }
    categories.push({ name, monthlyLimit });
    saveCategories();
    nameField.value = '';
    monthlyField.value = '';
    renderAll();
}

function saveSettings() {
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
    categories = updated;
    saveCategories();
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
const initialView = location.hash.replace('#', '');
switchView(initialView);
renderAll();
