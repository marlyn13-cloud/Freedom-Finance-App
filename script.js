// ===== Storage Keys =====
const TX_KEY  = "ff_transactions_v1";
const BUD_KEY = "ff_budgets_v1";
const CAT_KEY = "ff_categories_v1";
const USER_KEY = "ff_users_v1";
const SESSION_KEY = "ff_current_user_v1";

// ===== App State =====
let searchTerm = "";
let editingTxId = null;
let editingBudId = null;

// ===== Helpers =====
function uid(){ return Math.random().toString(16).slice(2) + Date.now().toString(16); }
function money(n){ return Number(n).toLocaleString(undefined, {style:"currency", currency:"USD"}); }
function escapeHtml(str){
  return String(str).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function isValidEmail(email){
  return /\S+@\S+\.\S+/.test(email);
}

function setSearch(v){
  searchTerm = (v || "").trim().toLowerCase();
  renderAll();
}

// --- Unified Modal Logic ---
function openModal(id){
  const el = document.getElementById(id);
  if(el) {
    el.classList.remove("hidden");
    el.style.display = "flex";
  }
}

function closeModal(id){
  const el = document.getElementById(id);
  if(el) {
    el.classList.add("hidden");
    el.style.display = "none";
  }
}

function backdropClose(e, id){ if(e.target.id === id) closeModal(id); }

document.addEventListener("keydown", (e) => {
  if(e.key === "Escape"){
    closeModal("txModal");
    closeModal("budgetModal");
  }
});

// ===== Auth Storage =====
function loadUsers(){
  try { return JSON.parse(localStorage.getItem(USER_KEY)) || []; }
  catch { return []; }
}
function saveUsers(users){ localStorage.setItem(USER_KEY, JSON.stringify(users)); }

function setCurrentUser(user){ localStorage.setItem(SESSION_KEY, JSON.stringify(user)); }

function getCurrentUser(){
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
  catch { return null; }
}

function clearCurrentUser(){ localStorage.removeItem(SESSION_KEY); }

// ===== Auth UI =====
function clearAuthMessages(){
  const ids = ["loginError", "signupError"];
  for(const id of ids){
    const el = document.getElementById(id);
    if(el){
      el.style.display = "none";
      el.textContent = "";
    }
  }
}

function showAuthError(id, msg){
  const el = document.getElementById(id);
  if(!el) return;
  el.style.display = "block";
  el.textContent = msg;
}

function showAuthView(name){
  clearAuthMessages();
  const loginView = document.getElementById("view-login");
  const signupView = document.getElementById("view-signup");

  if(loginView) loginView.classList.remove("active");
  if(signupView) signupView.classList.remove("active");

  const activeView = document.getElementById(`view-${name}`);
  if(activeView) activeView.classList.add("active");
}

function handleSignup(){
  clearAuthMessages();
  const username = (document.getElementById("signupUsername")?.value || "").trim();
  const email = (document.getElementById("signupEmail")?.value || "").trim().toLowerCase();
  const password = document.getElementById("signupPassword")?.value || "";
  const confirmPassword = document.getElementById("signupConfirmPassword")?.value || "";

  if(!username) return showAuthError("signupError", "Enter a username.");
  if(!email) return showAuthError("signupError", "Enter an email.");
  if(!isValidEmail(email)) return showAuthError("signupError", "Enter a valid email.");
  if(!password) return showAuthError("signupError", "Enter a password.");
  if(password.length < 6) return showAuthError("signupError", "Password must be at least 6 characters.");
  if(password !== confirmPassword) return showAuthError("signupError", "Passwords do not match.");

  const users = loadUsers();
  if(users.some(u => u.username.toLowerCase() === username.toLowerCase())) return showAuthError("signupError", "That username already exists.");
  if(users.some(u => u.email.toLowerCase() === email.toLowerCase())) return showAuthError("signupError", "That email is already registered.");

  users.push({ id: uid(), username, email, password });
  saveUsers(users);

  document.getElementById("loginIdentifier").value = email;
  showAuthView("login");
}

function handleLogin(){
  clearAuthMessages();
  const identifier = (document.getElementById("loginIdentifier")?.value || "").trim().toLowerCase();
  const password = document.getElementById("loginPassword")?.value || "";

  if(!identifier || !password) return showAuthError("loginError", "Fill in all fields.");

  const user = loadUsers().find(u => u.email.toLowerCase() === identifier || u.username.toLowerCase() === identifier);
  if(!user || user.password !== password) return showAuthError("loginError", "Invalid credentials.");

  setCurrentUser({ id: user.id, username: user.username, email: user.email });
  window.location.href = "dashboard.html";
}

window.logoutUser = function() {
  clearCurrentUser();
  window.location.href = "index.html";
}

function requireAuth(){
  if(document.getElementById("authPage")) return; 
  if(!getCurrentUser()) window.location.href = "index.html";
}

/* =========================================
   3. DATA LOAD / SAVE
   ========================================= */
function loadTx()   { try { return JSON.parse(localStorage.getItem(TX_KEY))  || []; } catch { return []; } }
function saveTx(txs){ localStorage.setItem(TX_KEY, JSON.stringify(txs)); }

function loadBudgets() {
  try {
    const b = JSON.parse(localStorage.getItem(BUD_KEY));
    if (Array.isArray(b)) return b;
  } catch { /**/ }
  
  // FIX: Start with a completely empty slate so no "Ghost" budgets appear!
  const seed = []; 
  
  saveBudgets(seed);
  return seed;
}
function saveBudgets(buds) { localStorage.setItem(BUD_KEY, JSON.stringify(buds)); }

function loadCategories() {
  try {
    const c = JSON.parse(localStorage.getItem(CAT_KEY));
    if (Array.isArray(c) && c.length) return c;
  } catch { /**/ }
  const defaults = ["Other", "Salary"];
  saveCategories(defaults);
  return defaults;
}
function saveCategories(cats) { localStorage.setItem(CAT_KEY, JSON.stringify(cats)); }

function expenseByCategory(txs) {
  const m = new Map();
  for (const t of txs) {
    if (t.type !== "expense") continue;
    
    // Normalize text: "food" or "FOOD" becomes "Food"
    const rawCat = (t.category || "Other").trim();
    const cat = rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase();
    
    m.set(cat, (m.get(cat) || 0) + Math.abs(Number(t.amount || 0)));
  }
  return m;
}
function getAllCategoryOptions() {
  const set = new Map();
  for (const c of loadCategories()) set.set(c.toLowerCase(), c);
  for (const b of loadBudgets())    set.set(b.category.toLowerCase(), b.category);
  for (const t of loadTx())         if (t.category) set.set(t.category.toLowerCase(), t.category);
  return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
}

/* =========================================
   4. CALCULATIONS
   ========================================= */
function computeTotals(txs) {
  let income = 0, expenses = 0, savings = 0, investment = 0;
  
  for (const t of txs) {
    // We use Math.abs() to make sure we are just adding the pure numbers to our buckets
    const amt = Math.abs(Number(t.amount || 0)); 
    
    if (t.type === "income")          income += amt;
    else if (t.type === "expense")    expenses += amt;
    else if (t.type === "savings")    savings += amt;
    else if (t.type === "investment") investment += amt;
  }
  
  // Total Balance (Net Position) is simply all the money you've made minus the money you've spent.
  const balance = income - expenses; 
  
  return { income, expenses, savings, investment, balance };
}

/* =========================================
   5. TRANSACTION UI
   ========================================= */
function clearTxError() { const b = document.getElementById("txError"); if (b) { b.style.display = "none"; b.textContent = ""; } }
function txError(msg) { const b = document.getElementById("txError"); if (b) { b.style.display = "block"; b.textContent = msg; } }

function populateTxCategoryDropdown(selected) {
  const sel = document.getElementById("txCategory");
  if (!sel) return;
  const cats = getAllCategoryOptions();
  sel.innerHTML = "";
  for (const c of cats) {
    const opt = document.createElement("option");
    opt.value = c; opt.textContent = c;
    sel.appendChild(opt);
  }
  const optNew = document.createElement("option");
  optNew.value = "__new__"; optNew.textContent = "+ New category...";
  sel.appendChild(optNew);
  sel.value = (selected && cats.includes(selected)) ? selected : (cats[0] || "Other");
  window.onTxCategoryChange();
}

window.onTxCategoryChange = function () {
  const sel   = document.getElementById("txCategory");
  const input = document.getElementById("txNewCategory");
  if (!sel || !input) return;
  if (sel.value === "__new__") { input.classList.remove("hidden"); input.value = ""; input.focus(); }
  else                         { input.classList.add("hidden");    input.value = ""; }
};

window.openTxModalAdd = function () {
  editingTxId = null;
  clearTxError();
  document.getElementById("txModalTitle").textContent = "Add Transaction";
  document.getElementById("txSaveBtn").textContent    = "Save";
  document.getElementById("txType").value             = "expense";
  document.getElementById("txDate").value             = new Date().toISOString().slice(0, 10);
  document.getElementById("txDesc").value             = "";
  document.getElementById("txAmount").value           = "";
  populateTxCategoryDropdown("Food");
  openModal("txModal");
};

window.openTxModalEdit = function (id) {
  const t = loadTx().find(x => x.id === id);
  if (!t) return;
  editingTxId = id;
  clearTxError();
  document.getElementById("txModalTitle").textContent = "Edit Transaction";
  document.getElementById("txSaveBtn").textContent    = "Update";
  document.getElementById("txType").value             = t.type;
  document.getElementById("txDate").value             = t.date || new Date().toISOString().slice(0, 10);
  document.getElementById("txDesc").value             = t.desc || "";
  document.getElementById("txAmount").value           = Math.abs(Number(t.amount || 0));
  populateTxCategoryDropdown(t.category || "Other");
  openModal("txModal");
};

window.saveTransaction = function () {
  clearTxError();
  const type      = document.getElementById("txType").value;
  const date      = document.getElementById("txDate").value;
  const desc      = (document.getElementById("txDesc").value || "").trim();
  const amountRaw = Number(document.getElementById("txAmount").value);

  if (!date) return txError("Pick a date.");
  if (!desc) return txError("Enter a description.");
  if (!Number.isFinite(amountRaw) || amountRaw <= 0) return txError("Amount must be positive.");

  let category = document.getElementById("txCategory").value;
  if (category === "__new__") {
    category = (document.getElementById("txNewCategory").value || "").trim();
    if (!category) return txError("Enter category name.");
    const cats = loadCategories();
    if (!cats.some(c => c.toLowerCase() === category.toLowerCase())) { cats.push(category); saveCategories(cats); }
  }

  const storedAmount = (type === "expense") ? -Math.abs(amountRaw) : Math.abs(amountRaw);
  const txs = loadTx();

  if (editingTxId) {
    const idx = txs.findIndex(x => x.id === editingTxId);
    if (idx >= 0) txs[idx] = { id: editingTxId, type, date, desc, amount: storedAmount, category };
  } else {
    txs.push({ id: uid(), type, date, desc, amount: storedAmount, category });
  }

  saveTx(txs);
  closeModal("txModal");
  renderAll();
};

// --- NEW: Populate the filter category dropdown ---
function populateFilterCategories() {
  const filterSel = document.getElementById("filterCategory");
  if (!filterSel) return;
  
  const currentVal = filterSel.value; // Remember what the user had selected
  
  filterSel.innerHTML = '<option value="all">All categories</option>';
  const cats = getAllCategoryOptions(); 
  
  cats.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.toLowerCase();
    opt.textContent = c;
    filterSel.appendChild(opt);
  });
  
  if (currentVal && cats.map(c => c.toLowerCase()).includes(currentVal)) {
    filterSel.value = currentVal; // Restore selection
  }
}

window.deleteTransaction = function (id) {
  saveTx(loadTx().filter(t => t.id !== id));
  renderAll();
};

/* =========================================
   6. BUDGET UI
   ========================================= */
function clearBudError() { const b = document.getElementById("budError"); if (b) { b.style.display = "none"; b.textContent = ""; } }
function budError(msg) { const b = document.getElementById("budError"); if (b) { b.style.display = "block"; b.textContent = msg; } }

window.openBudgetModalAdd = function () {
  editingBudId = null;
  clearBudError();
  document.getElementById("budgetModalTitle").textContent = "New Budget";
  document.getElementById("budSaveBtn").textContent       = "Save";
  document.getElementById("budCategory").value            = "";
  document.getElementById("budLimit").value               = "";
  openModal("budgetModal");
  document.getElementById("budCategory").focus();
};

window.openBudgetModalEdit = function (id) {
  const b = loadBudgets().find(x => x.id === id);
  if (!b) return;
  editingBudId = id;
  clearBudError();
  document.getElementById("budgetModalTitle").textContent = "Edit Budget";
  document.getElementById("budSaveBtn").textContent       = "Update";
  document.getElementById("budCategory").value            = b.category;
  document.getElementById("budLimit").value               = b.limit;
  openModal("budgetModal");
  document.getElementById("budCategory").focus();
};

window.saveBudget = function () {
  clearBudError();
  const cat = (document.getElementById("budCategory").value || "").trim();
  const lim = Number(document.getElementById("budLimit").value);

  if (!cat) return budError("Enter a category.");
  if (!Number.isFinite(lim) || lim < 0) return budError("Limit must be 0 or more.");

  let buds = loadBudgets();
  
  // Look for any existing budget with this exact name
  const existingBudget = buds.find(x => x.category.toLowerCase() === cat.toLowerCase());

  if (existingBudget) {
    // It's in the database (even if it's an invisible ghost)! 
    // Let's just update its limit to the new number and resurrect it.
    existingBudget.limit = lim;
    
    // If you were actively editing a DIFFERENT card and renamed it to this, clean up the old card.
    if (editingBudId && editingBudId !== existingBudget.id) {
       buds = buds.filter(x => x.id !== editingBudId);
    }
  } else if (editingBudId) {
    // Renaming a card to a completely new name
    const idx = buds.findIndex(x => x.id === editingBudId);
    if (idx >= 0) buds[idx] = { id: editingBudId, category: cat, limit: lim };
  } else {
    // Creating a completely new card
    buds.push({ id: uid(), category: cat, limit: lim });
  }

  saveBudgets(buds);
  closeModal("budgetModal");
  renderAll();
};

window.clearAllBudgets = function () {
  if (confirm("Clear all budgets?")) { saveBudgets([]); renderAll(); }
};

window.deleteBudget = function (id) {
  saveBudgets(loadBudgets().filter(b => b.id !== id));
  renderAll();
};

/* =========================================
   7. RENDERING
   ========================================= */
function renderAll() {
  const txs = loadTx();
  const buds = loadBudgets();
  const { income, expenses, savings, balance } = computeTotals(txs);
  
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("sum-income", money(income)); 
  set("sum-expenses", money(expenses));
  set("sum-savings", money(savings)); 
  set("sum-balance", money(balance));
  set("side-balance", money(balance));

  // --- PERCENTAGE MATH ---
  const sidePctEl = document.getElementById("side-savings-pct");
  if (sidePctEl) {
    const unspentPct = income > 0 ? Math.round((balance / income) * 100) : 0;
    sidePctEl.textContent = `${unspentPct}% of income saved`;
  }

  const cardPctEl = document.getElementById("sum-savings-pct");
  if (cardPctEl) {
    const dedicatedPct = income > 0 ? Math.round((savings / income) * 100) : 0;
    cardPctEl.textContent = `${dedicatedPct}% of income`;
  }

  // Render Recent Transactions (Dashboard)
  const recentWrap = document.getElementById("recentList");
  if (recentWrap) {
    recentWrap.innerHTML = "";
    txs.slice().sort((a,b) => b.date.localeCompare(a.date)).slice(0, 5).forEach(t => {
      const row = document.createElement("div");
      row.className = "tx-item";
      const isOutflow = (t.type === "expense" || t.type === "savings" || t.type === "investment");
      row.innerHTML = `
        <div class="tx-icon ${isOutflow ? 'bg-light-red' : 'bg-light-green'}">${isOutflow ? '🍔' : '💰'}</div>
        <div class="tx-info">
          <div class="tx-title">${escapeHtml(t.desc)}</div>
          <div class="tx-date">${escapeHtml(t.category)} • ${t.date}</div>
        </div>
        <div class="tx-meta">
          <div class="tx-amount ${isOutflow ? 'text-red' : 'text-green'}">${isOutflow ? '-' : '+'}${money(Math.abs(t.amount))}</div>
          <div class="tx-badge ${isOutflow ? 'badge-red' : 'badge-green'}">${t.type.toUpperCase()}</div>
        </div>`;
      recentWrap.appendChild(row);
    });
  }

  // Render All Transactions (Transaction Page)
  // Render All Transactions (Transaction Page)
  const allWrap = document.getElementById("allList");
  if (allWrap) {
    // 1. Get the current values from the search bar and dropdowns
    const searchInput = document.getElementById("searchTx");
    const typeSelect = document.getElementById("filterType");
    const catSelect = document.getElementById("filterCategory");
    
    const searchVal = searchInput ? searchInput.value.toLowerCase() : "";
    const typeVal = typeSelect ? typeSelect.value : "all";
    const catVal = catSelect ? catSelect.value : "all";

    // 2. Filter the transactions!
    let filteredTxs = txs.slice().sort((a,b) => b.date.localeCompare(a.date));
    
    if (searchVal) {
      filteredTxs = filteredTxs.filter(t => 
        t.desc.toLowerCase().includes(searchVal) || 
        t.category.toLowerCase().includes(searchVal)
      );
    }
    if (typeVal !== "all") {
      filteredTxs = filteredTxs.filter(t => t.type === typeVal);
    }
    if (catVal !== "all") {
      filteredTxs = filteredTxs.filter(t => t.category.toLowerCase() === catVal);
    }

    // 3. Update the total transaction count at the top of the page
    const txCountEl = document.getElementById("txCount");
    if (txCountEl) {
      txCountEl.textContent = `${filteredTxs.length} transaction${filteredTxs.length !== 1 ? 's' : ''}`;
    }

    // 4. Make sure the Category dropdown is up to date with any newly added categories
    populateFilterCategories();

    // 5. Draw the filtered list to the screen
    allWrap.innerHTML = "";
    if (filteredTxs.length === 0) {
       allWrap.innerHTML = "<div class='text-muted' style='padding: 32px; text-align: center;'>No transactions found.</div>";
    } else {
      filteredTxs.forEach(t => {
        const isOutflow = (t.type === "expense" || t.type === "savings" || t.type === "investment");
        const row = document.createElement("div");
        row.className = "tx-row";
        row.innerHTML = `
          <div class="col-desc">
            <div class="tx-icon ${isOutflow ? 'bg-light-red' : 'bg-light-green'}">${isOutflow ? '🍔' : '💰'}</div>
            <div class="tx-info"><div class="tx-title">${escapeHtml(t.desc)}</div><div class="tx-note">No notes</div></div>
          </div>
          <div class="col-cat"><span class="badge-pill">${escapeHtml(t.category)}</span></div>
          <div class="col-date">${t.date}</div>
          <div class="col-amt ${isOutflow ? 'text-red' : 'text-green'}">${isOutflow ? '-' : '+'}${money(Math.abs(t.amount))}</div>
          <div class="col-actions">
            <button class="icon-btn-small" onclick="window.openTxModalEdit('${t.id}')">📝</button>
            <button class="icon-btn-small" onclick="window.deleteTransaction('${t.id}')">🗑️</button>
          </div>`;
        allWrap.appendChild(row);
      });
    }
  }

  // Render Dashboard Spending by Category
  const dashCatList = document.querySelector(".category-list");
  if (dashCatList) { 
    const spentMap = expenseByCategory(txs);
    const sortedCats = Array.from(spentMap.entries()).sort((a,b) => b[1] - a[1]).slice(0, 3);
    const totalExp = expenses > 0 ? expenses : 1; 
    
    dashCatList.innerHTML = ""; 
    
    if(sortedCats.length === 0) {
      dashCatList.innerHTML = "<div class='text-muted' style='padding: 16px 0;'>No expenses logged yet.</div>";
    } else {
      const icons = ["🍔", "🛍️", "⛽", "💡", "🎮"];
      const colors = ["blue", "green", "red", "orange", "blue"];
      
      sortedCats.forEach((item, index) => {
        const [cat, amt] = item;
        const pct = Math.round((amt / totalExp) * 100);
        const icon = icons[index % icons.length];
        const color = colors[index % colors.length];
        
        dashCatList.innerHTML += `
          <div class="category-item">
            <div class="cat-icon bg-light-${color}">${icon}</div>
            <div class="cat-details">
              <div class="cat-header">
                <span class="cat-name">${escapeHtml(cat)}</span>
                <span class="cat-amount">${money(amt)}</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill fill-${color}" style="width: ${pct}%"></div>
              </div>
            </div>
          </div>
        `;
      });
    }
  }

  // Render Budget Cards
  const budContainer = document.querySelector(".budget-list");
  if (budContainer) {
    const spentMap = expenseByCategory(txs);
    budContainer.innerHTML = "";
    
    buds.forEach(b => {
      let spent = 0;
      for (const [tCat, amt] of spentMap.entries()) {
        if (tCat.toLowerCase() === b.category.toLowerCase()) {
          spent += amt;
        }
      }
      
      const pct = b.limit > 0 ? Math.min(100, Math.round((spent/b.limit)*100)) : 0;
      
      const isOver = spent > b.limit;
      const isNear = !isOver && pct >= 90; 
      
      let badgeClass = isOver ? 'badge-red' : (isNear ? 'badge-warning' : 'badge-green');
      let badgeText = isOver ? 'Over budget' : (isNear ? 'Nearing limit' : 'On track');
      let fillClass = isOver ? 'fill-red' : (isNear ? 'fill-orange' : 'fill-blue');
      let textClass = isOver ? 'text-red' : (isNear ? 'text-orange' : 'text-dark');
      
      const card = document.createElement("div");
      card.className = "budget-card";
      card.innerHTML = `
        <div class="bc-header">
          <div class="bc-title-group"><span>📊</span><span>${escapeHtml(b.category)}</span></div>
          <div class="bc-actions">
            <span class="tx-badge ${badgeClass}">${badgeText}</span>
            <button class="btn-close" onclick="window.deleteBudget('${b.id}')">✕</button>
          </div>
        </div>
        <div class="bc-sub">Monthly budget</div>
        <div class="bc-amounts">
          <span class="bc-spent ${textClass}">${money(spent)}</span>
          <span class="bc-limit">of ${money(b.limit)}</span>
        </div>
        <div class="bc-progress">
          <div class="progress-fill ${fillClass}" style="width: ${pct}%"></div>
        </div>
        <div class="bc-footer">
          <span>${isOver ? money(spent-b.limit) + ' over' : money(b.limit-spent) + ' remaining'}</span>
          <span>${pct}%</span>
        </div>`;
      budContainer.appendChild(card);
    });
  }
  // --- Render Reports Page ---
  const reportsChartWrap = document.getElementById("reportsChartWrap");
  if (reportsChartWrap) {
    const map = expenseByCategory(txs);
    const rows = Array.from(map.entries()).sort((a, b) => b[1] - a[1]); // Sort highest to lowest
    
    if (rows.length === 0) {
      reportsChartWrap.innerHTML = `<div class="chart-empty">No expenses logged yet. Add some transactions to generate reports!</div>`;
    } else {
      const colors = ["#ef4444", "#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#64748b"];
      const total = rows.reduce((s, r) => s + r[1], 0);
      let stops = [], cur = 0, legendHtml = "";
      
      for (let i = 0; i < rows.length; i++) {
        const [cat, val] = rows[i];
        const pct = (val / total) * 100;
        const color = colors[i % colors.length];
        
        stops.push(`${color} ${cur}% ${cur + pct}%`);
        cur += pct;
        
        legendHtml += `
          <div class="legend-item">
            <div class="legend-left">
              <div class="legend-color" style="background:${color}"></div>
              <div class="legend-label">${escapeHtml(cat)}</div>
            </div>
            <div class="legend-val">${money(val)}</div>
          </div>`;
      }
      
      reportsChartWrap.innerHTML = `
        <div class="pie-container">
          <div class="pie-chart" style="background:conic-gradient(${stops.join(",")})"></div>
          <div class="pie-legend">${legendHtml}</div>
        </div>`;
        
      // Populate the List below the chart
      const catListEl = document.getElementById("categoryTotalsList");
      if(catListEl) {
        catListEl.innerHTML = "";
        rows.forEach((item, index) => {
          const [cat, amt] = item;
          const pct = Math.round((amt / total) * 100);
          const colorClass = ["red", "blue", "orange", "green", "blue", "red", "orange"][index % 7];
          
          catListEl.innerHTML += `
            <div class="category-item">
              <div class="cat-details">
                <div class="cat-header">
                  <span class="cat-name">${escapeHtml(cat)}</span>
                  <span class="cat-amount">${money(amt)}</span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill fill-${colorClass}" style="width: ${pct}%"></div>
                </div>
              </div>
            </div>`;
        });
      }
    }
  }
/* =========================================
   10. EXPORT DATA
========================================= */
window.exportToPDF = function() {
  const txs = loadTx();
  if (txs.length === 0) {
    alert("You have no transactions to export!");
    return;
  }

  // 1. Initialize the PDF document
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // 2. Add a Title to the document
  doc.setFontSize(18);
  doc.text("Freedom Finance - Expense Report", 14, 20);
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);

  // 3. Format the data for the table
  const tableColumns = ["Date", "Description", "Category", "Type", "Amount"];
  const tableRows = [];

  // Loop through your transactions and push them into the rows array
  txs.forEach(t => {
    // Add a + or - sign to the amount for better readability
    const sign = t.type === "expense" ? "-" : "+";
    const formattedAmount = `${sign}${money(t.amount)}`;
    
    // Create an array for this specific row
    const rowData = [
      t.date,
      t.desc,
      t.category,
      t.type.toUpperCase(),
      formattedAmount
    ];
    tableRows.push(rowData);
  });

  // 4. Draw the Table using the autotable plugin
  doc.autoTable({
    head: [tableColumns],
    body: tableRows,
    startY: 35, // Start drawing the table below the title
    theme: 'striped', // Gives it a nice alternating gray/white background
    headStyles: { fillColor: [59, 130, 246] }, // Uses your Freedom Finance blue!
  });

  // 5. Trigger the Download
  doc.save(`FreedomFinance_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
};
} // <--- This is the ONLY closing bracket for the renderAll function!
/* =========================================
   8. AI CHATBOT — SPARK (LOCAL MODEL + Transformers.js, rivescript.js for routing, langchain.js for prompt management,
   fuse.js for semantic search — ALL RUNNING LOCALLY IN THE BROWSER.NO API CALLS. , currency.js for money formatting)
   ========================================= */
let rs = null;
let aiPipeline = null;
let LangchainPromptTemplate = null;
let isAiReady = false;

function initRiveScript() {
  if (typeof window.RiveScript === "undefined") return;
  rs = new window.RiveScript();
  rs.stream(`
    + hello
    - Hi there! I'm Spark ✨, your financial assistant. How can I help you today?
    + hi
    @ hello
    + hey
    @ hello
    + thank you
    - You're welcome! Keep up the great financial work!
    + thanks
    @ thank you
    + *
    - CALL_LLM
  `);
  rs.sortReplies();
}

window.toggleChat = function () {
  const win = document.getElementById("spark-chat-window");
  if (!win) return;
  win.classList.toggle("hidden");
  
  if (!aiPipeline && !win.classList.contains("hidden")) {
    initializeSparkAI();
  }
};

window.handleSparkSend = async function () {
  const inputEl = document.getElementById("spark-input");
  const message = inputEl.value.trim();
  if (!message) return;

  appendMessage("user", message);
  inputEl.value = "";

  let reply = "CALL_LLM";
  if (rs) {
    try { 
      reply = await rs.reply("local-user", message.toLowerCase()); 
    } catch { 
      reply = "CALL_LLM"; 
    }
  }

  if (reply === "CALL_LLM") {
    const typingId = appendMessage("bot", "Spark is thinking... (Running local AI)");
    
    try {
      reply = await generateAIResponse(message);
    } catch (err) {
      console.error("Chat Error:", err);
      reply = "Sorry, I hit a snag trying to process that. Could you try again?";
    }

    const el = document.getElementById(typingId);
    if (el) el.innerText = reply;
  } else {
    appendMessage("bot", reply);
  }
  scrollToBottom();
};
/*Initiate local AI Model*/
async function initializeSparkAI() {
  const inputEl = document.getElementById("spark-input");
  const sendBtn = document.getElementById("spark-send-btn");
  
  const loadingId = appendMessage("bot", "Waking up my AI brain... (Downloading local model. This may take a minute!)");
  
  try {
    const langchain = await import('https://esm.sh/@langchain/core@0.1.58/prompts?bundle');
    LangchainPromptTemplate = langchain.PromptTemplate;

    const transformers = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers');
    transformers.env.allowLocalModels = false;
    
    aiPipeline = await transformers.pipeline('text-generation', 'HuggingFaceTB/SmolLM-135M-Instruct');
    
    document.getElementById(loadingId).innerText = "I'm online and ready! Ask me for advice or search your transactions.";
    isAiReady = true;
    
    if (inputEl) inputEl.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    if (inputEl) inputEl.focus();
  } catch (error) {
    console.error("AI Load Error:", error);
    document.getElementById(loadingId).innerText = "Oops! I had trouble waking up. Please check your internet connection.";
  }
}

function toMoney(val) {
  return window.currency ? window.currency(val).format() : `$${Number(val).toFixed(2)}`;
}

/*Ai generates responses based on user input, using the same data and calculations as the dashboard for accurate answers. 
It also includes a smart interceptor to route common questions to pre-built answers for instant responses, while more complex queries trigger the local AI model for analysis. */

async function generateAIResponse(userMessage) {
  if (!isAiReady) return "I'm still waking up! Give me just a second.";

  const txs = JSON.parse(localStorage.getItem("ff_transactions_v1")) || [];
  const buds = JSON.parse(localStorage.getItem("ff_budgets_v1")) || [];
  
  // Uses the exact math the dashboard uses
  const totals = computeTotals(txs);
  const spentMap = expenseByCategory(txs); 
  
  // SMART INTERCEPTOR
  const lowerMsg = userMessage.toLowerCase();

  // Takes filler words to isolate the actual search term
  const stopWords = /\b(what|whats|what's|is|are|am|my|the|a|an|transaction|transactions|budget|budgets|overbudget|amount|cost|for|how|much|did|i|spend|on|find|search|show|me|tell|about)\b/gi;
  const searchWords = lowerMsg.replace(stopWords, "").replace(/[^a-z0-9\s]/gi, "").trim();

  // Route A: Savings
  if (lowerMsg.includes("saving") && !lowerMsg.includes("increase") && !lowerMsg.includes("would i")) {
    return `Dashboard: Your total savings are ${toMoney(totals.savings)}.`;
  }

  // Route B: Dashboard Questions
  if (lowerMsg.includes("balance") || (lowerMsg.includes("total") && !lowerMsg.includes("budget"))) {
    return `Dashboard: Your total balance is ${toMoney(totals.balance)}. (Income: ${toMoney(totals.income)}, Expenses: ${toMoney(totals.expenses)}, Savings: ${toMoney(totals.savings)})`;
  }
  if (lowerMsg.includes("income")) {
    return `Dashboard: Your total income is ${toMoney(totals.income)}.`;
  }
  if (lowerMsg.includes("expense") || lowerMsg.includes("spent") || lowerMsg.includes("spend")) {
    if (searchWords.length === 0 && !lowerMsg.includes("too much")) { 
      return `Dashboard: Your total expenses are ${toMoney(totals.expenses)}.`;
    }
  }

  // Route C: Financial Advice & Suggestions
  if (lowerMsg.includes("too much") || lowerMsg.includes("cut down") || lowerMsg.includes("would i save") || lowerMsg.includes("invest") || lowerMsg.includes("advice") || lowerMsg.includes("suggestion") || lowerMsg.includes("help me save")) {
     let highestCat = "nothing";
     let highestAmt = 0;
     
     // Loop through the spentMap to find the biggest spender
     for (const [cat, amt] of spentMap.entries()) {
       if (amt > highestAmt) {
         highestAmt = amt;
         highestCat = cat;
       }
     }

     if (highestAmt > 0) {
       const cutAmount = highestAmt * 0.20; // e.g Suggest a 20% cut
       return `Insight: Your highest expense right now is ${highestCat} (${toMoney(highestAmt)}). If you cut down your ${highestCat} spending by just 20%, you could save/invest an extra ${toMoney(cutAmount)} this month!`;
     } else {
       return "Insight: You don't have any expenses logged yet! Once you add some transactions, I can analyze where you can save money.";
     }
  }

  // Route D: Budget / Overbudget Questions
  if (lowerMsg.includes("budget") || lowerMsg.includes("allowance") || lowerMsg.includes("overbudget") || lowerMsg.includes("over budget")) {
     if (buds.length > 0) {
       
       let targetBud = null;

       if (searchWords.length > 0 && window.Fuse) {
         const fuseBud = new window.Fuse(buds, { keys: ['category'], threshold: 0.4 });
         const budResults = fuseBud.search(searchWords).map(res => res.item);
         if (budResults.length > 0) {
           targetBud = budResults[0];
         }
       }
       
       if (targetBud) {
         const limit = Number(targetBud.limit);
         const spent = spentMap.get(targetBud.category) || 0;
         const left = limit - spent;

         if (lowerMsg.includes("overbudget") || lowerMsg.includes("over budget")) {
           if (left < 0) {
             return `Yes, you are overbudget for ${targetBud.category}. You are over your limit by ${toMoney(Math.abs(left))}.`;
           } else if (left === 0) {
             return `You have reached your exact limit for ${targetBud.category}. You have $0 left to spend in this category.`;
           } else {
             return `No, you are not overbudget for ${targetBud.category}. You still have ${toMoney(left)} left to spend.`;
           }
         } 
         else {
           return `Budget: Your limit for ${targetBud.category} is ${toMoney(limit)}. You have spent ${toMoney(spent)}, leaving you with ${toMoney(left)} left.`;
         }
       } 
       else {
         const totalBud = buds.reduce((s,b) => s + Number(b.limit), 0);
         return `Budget: Your total planned budget across all categories is ${toMoney(totalBud)}.`;
       }
     } else {
       return "Budget: You don't have any budgets set up yet.";
     }
  }

  // Route E: Transaction Searches
  if (window.Fuse && txs.length > 0) {
    if (searchWords.length > 1) { 
      const fuseTx = new window.Fuse(txs, { keys: ['desc', 'category'], threshold: 0.4 });
      const txResults = fuseTx.search(searchWords).map(res => res.item);
      
      if (txResults.length > 0) {
        const t = txResults[0]; 
        const sign = t.type === "expense" ? "-" : "+";
        return `${t.desc}: ${t.date} | Amount: ${sign}${toMoney(t.amount)}`;
      }
    }
  }

  // Fallback to Local AI for general chat
  try {
    const promptTemplate = LangchainPromptTemplate.fromTemplate(`
<|im_start|>system
You are Spark, a helpful financial assistant. Answer briefly and conversationally. Do not write formulas, code, or math equations.<|im_end|>
<|im_start|>user
{question}<|im_end|>
<|im_start|>assistant
`);

    const formattedPrompt = await promptTemplate.format({
      question: userMessage
    });

    const output = await aiPipeline(formattedPrompt, {
      max_new_tokens: 60,
      do_sample: false,
      return_full_text: false 
    });

    let replyText = output[0].generated_text;

    if (replyText.includes("assistant\n")) {
      const parts = replyText.split("assistant\n");
      replyText = parts[parts.length - 1];
    }

    return replyText.trim() || "I couldn't find a matching transaction. Try asking about a specific item like 'food' or 'groceries'!";

  } catch (error) {
    console.error("The REAL Generation Error:", error); 
    return "I couldn't find a matching transaction or budget. Try searching for a specific expense!";
  }
}

function appendMessage(sender, text) {
  const chatBody = document.getElementById("spark-chat-body");
  if (!chatBody) return null;
  const div = document.createElement("div");
  div.className = "chat-msg " + sender;
  div.id = "msg-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  div.innerText = text;
  
  if (sender === "user") {
    div.style.cssText =
      "background:var(--color-primary);color:#fff;align-self:flex-end;" +
      "border-bottom-left-radius:12px;border-bottom-right-radius:4px;margin-left:auto;";
  }
  chatBody.appendChild(div);
  scrollToBottom();
  return div.id;
}

function scrollToBottom() {
  const cb = document.getElementById("spark-chat-body");
  if (cb) cb.scrollTop = cb.scrollHeight;
}

/* =========================================
   9. INITIALIZATION
   ========================================= */
document.addEventListener("DOMContentLoaded", () => {
  // --- NEW: Automatically set today's date ---
  const dateEl = document.getElementById("current-date-display");
  if (dateEl) {
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = `Today is ${today.toLocaleDateString('en-US', options)}`;
  }

  // Ensure user is logged in
  requireAuth();
  
  // Load data and render the screen
  loadBudgets();
  loadCategories();
  renderAll();
  
  // Initialize AI
  initRiveScript();

  const sparkInput = document.getElementById("spark-input");
  if (sparkInput) {
    sparkInput.addEventListener("keypress", (e) => { 
      if (e.key === "Enter") window.handleSparkSend(); 
    });
  }
});