// Global variables
let currentMonth = new Date().getMonth() + 1;
let currentYear = new Date().getFullYear();
let categories = [];
let categoryChart = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Set current date
    const monthSelect = document.getElementById('monthSelect');
    const yearSelect = document.getElementById('yearSelect');
    const dateInput = document.getElementById('date');
    
    monthSelect.value = String(currentMonth).padStart(2, '0');
    yearSelect.value = currentYear;
    
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    
    // Event listeners
    setupEventListeners();
    
    // Load initial data
    loadCategories();
    loadDashboard();
    
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration failed'));
    }
}

function setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTab(e.target.closest('.tab-btn').dataset.tab);
        });
    });
    
    // Month/Year change
    document.getElementById('monthSelect').addEventListener('change', (e) => {
        currentMonth = parseInt(e.target.value);
        refreshCurrentView();
    });
    
    document.getElementById('yearSelect').addEventListener('change', (e) => {
        currentYear = parseInt(e.target.value);
        refreshCurrentView();
    });
    
    // Transaction form
    document.getElementById('transactionForm').addEventListener('submit', handleTransactionSubmit);
    
    // Transaction type change
    document.querySelectorAll('input[name="type"]').forEach(radio => {
        radio.addEventListener('change', () => {
            loadCategoriesForForm();
        });
    });
    
    // Filter changes
    document.getElementById('filterType')?.addEventListener('change', loadTransactions);
    document.getElementById('filterPerson')?.addEventListener('change', loadTransactions);
    
    // Budget form
    document.getElementById('budgetForm')?.addEventListener('submit', handleBudgetSubmit);
    
    // Edit form
    document.getElementById('editForm')?.addEventListener('submit', handleEditSubmit);
    
    // Edit type change
    document.querySelectorAll('input[name="editType"]').forEach(radio => {
        radio.addEventListener('change', () => {
            loadCategoriesForEdit();
        });
    });
}

function switchTab(tabName) {
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update active tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabName);
    });
    
    // Load tab-specific data
    switch(tabName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'transactions':
            loadTransactions();
            break;
        case 'budgets':
            loadBudgets();
            break;
        case 'add':
            loadCategoriesForForm();
            break;
    }
}

function refreshCurrentView() {
    const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
    switchTab(activeTab);
}

// API Functions
async function apiCall(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        showNotification('Error al conectar con el servidor', 'error');
        return null;
    }
}

async function loadCategories() {
    categories = await apiCall('/api/categories') || [];
    loadCategoriesForForm();
}

function loadCategoriesForForm() {
    const type = document.querySelector('input[name="type"]:checked')?.value || 'expense';
    const select = document.getElementById('category');
    const budgetSelect = document.getElementById('budgetCategory');
    
    const filteredCategories = categories.filter(cat => cat.type === type);
    
    if (select) {
        select.innerHTML = '<option value="">Seleccionar categoría</option>';
        filteredCategories.forEach(cat => {
            select.innerHTML += `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`;
        });
    }
    
    if (budgetSelect) {
        budgetSelect.innerHTML = '<option value="">Seleccionar categoría</option>';
        categories.filter(cat => cat.type === 'expense').forEach(cat => {
            budgetSelect.innerHTML += `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`;
        });
    }
}

function loadCategoriesForEdit() {
    const type = document.querySelector('input[name="editType"]:checked')?.value || 'expense';
    const select = document.getElementById('editCategory');
    
    const filteredCategories = categories.filter(cat => cat.type === type);
    
    if (select) {
        select.innerHTML = '<option value="">Seleccionar categoría</option>';
        filteredCategories.forEach(cat => {
            select.innerHTML += `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`;
        });
    }
}

async function loadDashboard() {
    const data = await apiCall(`/api/summary?month=${currentMonth}&year=${currentYear}`);
    if (!data) return;
    
    // Update summary cards
    document.getElementById('totalIncome').textContent = `S/ ${data.totalIncome.toFixed(2)}`;
    document.getElementById('totalExpenses').textContent = `S/ ${data.totalExpenses.toFixed(2)}`;
    document.getElementById('balance').textContent = `S/ ${data.balance.toFixed(2)}`;
    
    // Update balance color
    const balanceElement = document.getElementById('balance');
    balanceElement.style.color = data.balance >= 0 ? 'var(--secondary-color)' : 'var(--danger-color)';
    
    // Update category chart
    updateCategoryChart(data.expensesByCategory);
    
    // Update person expenses
    updatePersonExpenses(data.expensesByPerson);
    
    // Load recent transactions
    loadRecentTransactions();
}

function updateCategoryChart(data) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    
    const chartData = {
        labels: data.map(d => d.name),
        datasets: [{
            data: data.map(d => d.total),
            backgroundColor: data.map(d => d.color || '#4A90E2'),
            borderWidth: 0
        }]
    };
    
    if (categoryChart) {
        categoryChart.data = chartData;
        categoryChart.update();
    } else {
        categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': S/ ' + context.parsed.toFixed(2);
                            }
                        }
                    }
                }
            }
        });
    }
}

function updatePersonExpenses(data) {
    const container = document.getElementById('personExpenses');
    if (!container) return;
    
    if (data.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><div>No hay gastos por persona</div></div>';
        return;
    }
    
    container.innerHTML = data.map(person => `
        <div class="person-item">
            <span class="person-name">👤 ${person.person}</span>
            <span class="person-amount">S/ ${person.total.toFixed(2)}</span>
        </div>
    `).join('');
}

async function loadRecentTransactions() {
    const transactions = await apiCall(`/api/transactions?month=${currentMonth}&year=${currentYear}`);
    if (!transactions) return;
    
    const container = document.getElementById('recentTransactions');
    if (!container) return;
    
    const recent = transactions.slice(0, 5);
    
    if (recent.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📝</div><div>No hay transacciones este mes</div></div>';
        return;
    }
    
    container.innerHTML = recent.map(t => createTransactionHTML(t)).join('');
}

async function loadTransactions() {
    const type = document.getElementById('filterType')?.value || '';
    const person = document.getElementById('filterPerson')?.value || '';
    
    let url = `/api/transactions?month=${currentMonth}&year=${currentYear}`;
    if (type) url += `&type=${type}`;
    if (person) url += `&person=${person}`;
    
    const transactions = await apiCall(url);
    if (!transactions) return;
    
    const container = document.getElementById('transactionsList');
    if (!container) return;
    
    // Update person filter options
    updatePersonFilter(transactions);
    
    if (transactions.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📝</div><div>No hay transacciones</div></div>';
        return;
    }
    
    container.innerHTML = transactions.map(t => createTransactionHTML(t)).join('');
}

function updatePersonFilter(transactions) {
    const filter = document.getElementById('filterPerson');
    if (!filter) return;
    
    const persons = [...new Set(transactions.filter(t => t.person).map(t => t.person))];
    const currentValue = filter.value;
    
    filter.innerHTML = '<option value="">Todas las personas</option>';
    persons.forEach(person => {
        filter.innerHTML += `<option value="${person}">${person}</option>`;
    });
    
    filter.value = currentValue;
}

function createTransactionHTML(transaction) {
    const date = new Date(transaction.date);
    const formattedDate = date.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
    
    return `
        <div class="transaction-item" onclick="openEditModal(${transaction.id})">
            <div class="transaction-left">
                <div class="transaction-icon">${transaction.icon || '💰'}</div>
                <div class="transaction-details">
                    <div class="transaction-category">${transaction.category_name || 'Sin categoría'}</div>
                    ${transaction.description ? `<div class="transaction-description">${transaction.description}</div>` : ''}
                    <div class="transaction-date">${formattedDate}</div>
                </div>
            </div>
            <div class="transaction-right">
                <div class="transaction-amount ${transaction.type}">
                    ${transaction.type === 'income' ? '+' : '-'} S/ ${Math.abs(transaction.amount).toFixed(2)}
                </div>
                ${transaction.person ? `<div class="transaction-person">${transaction.person}</div>` : ''}
            </div>
        </div>
    `;
}

async function loadBudgets() {
    const budgets = await apiCall(`/api/budgets?month=${currentMonth}&year=${currentYear}`);
    if (!budgets) return;
    
    const container = document.getElementById('budgetList');
    if (!container) return;
    
    if (budgets.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎯</div><div>No hay presupuestos configurados</div></div>';
        return;
    }
    
    container.innerHTML = budgets.map(budget => {
        const percentage = (budget.spent / budget.amount) * 100;
        const progressClass = percentage > 100 ? 'danger' : percentage > 80 ? 'warning' : '';
        
        return `
            <div class="budget-item">
                <div class="budget-header">
                    <div class="budget-category">
                        <span>${budget.icon || '💰'}</span>
                        <span>${budget.category_name}</span>
                    </div>
                    <div class="budget-amount">S/ ${budget.amount.toFixed(2)}</div>
                </div>
                <div class="budget-progress">
                    <div class="progress-bar">
                        <div class="progress-fill ${progressClass}" style="width: ${Math.min(percentage, 100)}%"></div>
                    </div>
                </div>
                <div class="budget-details">
                    <span>Gastado: S/ ${budget.spent.toFixed(2)}</span>
                    <span>${percentage.toFixed(0)}%</span>
                </div>
            </div>
        `;
    }).join('');
}

// Form Handlers
async function handleTransactionSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
        amount: parseFloat(formData.get('amount')),
        category_id: parseInt(formData.get('category_id')),
        description: formData.get('description'),
        date: formData.get('date'),
        type: formData.get('type'),
        person: formData.get('person'),
        is_recurring: formData.get('is_recurring') ? 1 : 0
    };
    
    const result = await apiCall('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(data)
    });
    
    if (result) {
        showNotification('Transacción guardada exitosamente', 'success');
        e.target.reset();
        document.getElementById('date').value = new Date().toISOString().split('T')[0];
        switchTab('dashboard');
    }
}

async function handleBudgetSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
        category_id: parseInt(formData.get('category_id')),
        amount: parseFloat(formData.get('amount')),
        month: String(currentMonth).padStart(2, '0'),
        year: currentYear
    };
    
    const result = await apiCall('/api/budgets', {
        method: 'POST',
        body: JSON.stringify(data)
    });
    
    if (result) {
        showNotification('Presupuesto configurado exitosamente', 'success');
        closeBudgetModal();
        loadBudgets();
    }
}

async function handleEditSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('editId').value;
    const data = {
        amount: parseFloat(document.getElementById('editAmount').value),
        category_id: parseInt(document.getElementById('editCategory').value),
        description: document.getElementById('editDescription').value,
        date: document.getElementById('editDate').value,
        type: document.querySelector('input[name="editType"]:checked').value,
        person: document.getElementById('editPerson').value
    };
    
    const result = await apiCall(`/api/transactions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
    
    if (result) {
        showNotification('Transacción actualizada exitosamente', 'success');
        closeEditModal();
        refreshCurrentView();
    }
}

async function deleteTransaction() {
    const id = document.getElementById('editId').value;
    
    if (confirm('¿Estás seguro de eliminar esta transacción?')) {
        const result = await apiCall(`/api/transactions/${id}`, {
            method: 'DELETE'
        });
        
        if (result) {
            showNotification('Transacción eliminada exitosamente', 'success');
            closeEditModal();
            refreshCurrentView();
        }
    }
}

// Modal Functions
function showBudgetModal() {
    document.getElementById('budgetModal').classList.add('active');
}

function closeBudgetModal() {
    document.getElementById('budgetModal').classList.remove('active');
    document.getElementById('budgetForm').reset();
}

async function openEditModal(transactionId) {
    const transactions = await apiCall(`/api/transactions?month=${currentMonth}&year=${currentYear}`);
    const transaction = transactions.find(t => t.id === transactionId);
    
    if (!transaction) return;
    
    document.getElementById('editId').value = transaction.id;
    document.getElementById('editAmount').value = transaction.amount;
    document.querySelector(`input[name="editType"][value="${transaction.type}"]`).checked = true;
    
    await loadCategoriesForEdit();
    
    document.getElementById('editCategory').value = transaction.category_id;
    document.getElementById('editDescription').value = transaction.description || '';
    document.getElementById('editDate').value = transaction.date;
    document.getElementById('editPerson').value = transaction.person || '';
    
    document.getElementById('editModal').classList.add('active');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
    document.getElementById('editForm').reset();
}

// Notification System
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? 'var(--secondary-color)' : type === 'error' ? 'var(--danger-color)' : 'var(--primary-color)'};
        color: white;
        border-radius: 8px;
        box-shadow: var(--shadow-lg);
        z-index: 2000;
        animation: slideInRight 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
