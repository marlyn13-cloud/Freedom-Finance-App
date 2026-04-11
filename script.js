// ===== 1. STORAGE KEYS & STATE =====
const TX_KEY  = "ff_transactions_v1";
const BUD_KEY = "ff_budgets_v1";
const CAT_KEY = "ff_categories_v1";
const USER_KEY = "ff_users_v1";
const SESSION_KEY = "ff_current_user_v1";

let editingTxId = null;
let editingBudId = null;
let isRendering = false; // Safety lock against infinite loops

// ===== 2. HELPERS =====
function uid(){ return Math.random().toString(16).slice(2) + Date.now().toString(16); }
function money(n){ return Number(n).toLocaleString(undefined, {style:"currency", currency:"USD"}); }
function escapeHtml(str){ return String(str).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function isValidEmail(email){ return /\S+@\S+\.\S+/.test(email); }

// --- Modal Logic ---
function openModal(id){ const el = document.getElementById(id); if(el) { el.classList.remove("hidden"); el.style.display = "flex"; } }
function closeModal(id){ const el = document.getElementById(id); if(el) { el.classList.add("hidden"); el.style.display = "none"; } }
function backdropClose(e, id){ if(e.target.id === id) closeModal(id); }
document.addEventListener("keydown", (e) => { if(e.key === "Escape"){ closeModal("txModal"); closeModal("budgetModal"); } });

// ===== 3. AUTHENTICATION =====
function loadUsers(){ try { return JSON.parse(localStorage.getItem(USER_KEY)) || []; } catch { return []; } }
function saveUsers(users){ localStorage.setItem(USER_KEY, JSON.stringify(users)); }
function setCurrentUser(user){ localStorage.setItem(SESSION_KEY, JSON.stringify(user)); }
function getCurrentUser(){ try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } }
function clearCurrentUser(){ localStorage.removeItem(SESSION_KEY); }

function clearAuthMessages(){
  ["loginError", "signupError"].forEach(id => {
    const el = document.getElementById(id);
    if(el){ el.style.display = "none"; el.textContent = ""; }
  });
}
function showAuthError(id, msg){ const el = document.getElementById(id); if(el){ el.style.display = "block"; el.textContent = msg; } }
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

  if(!username || !email || !isValidEmail(email) || password.length < 6 || password !== confirmPassword) {
    return showAuthError("signupError", "Please check your inputs and try again.");
  }
  const users = loadUsers();
  if(users.some(u => u.email.toLowerCase() === email)) return showAuthError("signupError", "Email already exists.");
  users.push({ id: uid(), username, email, password });
  saveUsers(users);
  document.getElementById("loginIdentifier").value = email;
  showAuthView("login");
}

function handleLogin(){
  clearAuthMessages();
  const identifier = (document.getElementById("loginIdentifier")?.value || "").trim().toLowerCase();
  const password = document.getElementById("loginPassword")?.value || "";
  const user = loadUsers().find(u => u.email.toLowerCase() === identifier || u.username.toLowerCase() === identifier);
  
  if(!user || user.password !== password) return showAuthError("loginError", "Invalid credentials.");
  setCurrentUser({ id: user.id, username: user.username, email: user.email });
  window.location.href = "dashboard.html";
}

window.logoutUser = function() { clearCurrentUser(); window.location.href = "index.html"; }
function requireAuth(){ if(!document.getElementById("authPage") && !getCurrentUser()) window.location.href = "index.html"; }

// ===== 4. DATA LOGIC =====
function loadTx()   { try { return JSON.parse(localStorage.getItem(TX_KEY)) || []; } catch { return []; } }
function saveTx(txs){ localStorage.setItem(TX_KEY, JSON.stringify(txs)); }
function loadBudgets() { try { const b = JSON.parse(localStorage.getItem(BUD_KEY)); if (Array.isArray(b)) return b; } catch { /**/ } const seed = []; saveBudgets(seed); return seed; }
function saveBudgets(buds) { localStorage.setItem(BUD_KEY, JSON.stringify(buds)); }
function loadCategories() { try { const c = JSON.parse(localStorage.getItem(CAT_KEY)); if (Array.isArray(c) && c.length) return c; } catch { /**/ } const defaults = ["Other", "Salary"]; saveCategories(defaults); return defaults; }
function saveCategories(cats) { localStorage.setItem(CAT_KEY, JSON.stringify(cats)); }

function expenseByCategory(txs) {
  const m = new Map();
  for (const t of txs) {
    if (t.type !== "expense") continue;
    const cat = (t.category || "Other").trim();
    const formattedCat = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
    m.set(formattedCat, (m.get(formattedCat) || 0) + Math.abs(Number(t.amount || 0)));
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

function computeTotals(txs) {
  let income = 0, expenses = 0, savings = 0, investment = 0;
  for (const t of txs) {
    const amt = Math.abs(Number(t.amount || 0)); 
    if (t.type === "income") income += amt;
    else if (t.type === "expense") expenses += amt;
    else if (t.type === "savings") savings += amt;
    else if (t.type === "investment") investment += amt;
  }
  return { income, expenses, savings, investment, balance: income - expenses };
}

// ===== 5. TRANSACTIONS UI =====
function txError(msg) { const b = document.getElementById("txError"); if (b) { b.style.display = "block"; b.textContent = msg; } }
function clearTxError() { const b = document.getElementById("txError"); if (b) b.style.display = "none"; }

function populateTxCategoryDropdown(selected) {
  const sel = document.getElementById("txCategory");
  if (!sel) return;
  const cats = getAllCategoryOptions();
  sel.innerHTML = "";
  cats.forEach(c => { const opt = document.createElement("option"); opt.value = c; opt.textContent = c; sel.appendChild(opt); });
  const optNew = document.createElement("option"); optNew.value = "__new__"; optNew.textContent = "+ New category..."; sel.appendChild(optNew);
  sel.value = (selected && cats.includes(selected)) ? selected : (cats[0] || "Other");
  window.onTxCategoryChange();
}

window.onTxCategoryChange = function () {
  const sel = document.getElementById("txCategory"); const input = document.getElementById("txNewCategory");
  if (!sel || !input) return;
  if (sel.value === "__new__") { input.classList.remove("hidden"); input.value = ""; input.focus(); }
  else { input.classList.add("hidden"); input.value = ""; }
};

window.openTxModalAdd = function () {
  editingTxId = null; clearTxError();
  document.getElementById("txModalTitle").textContent = "Add Transaction";
  document.getElementById("txSaveBtn").textContent = "Save";
  document.getElementById("txType").value = "expense";
  document.getElementById("txDate").value = new Date().toISOString().slice(0, 10);
  document.getElementById("txDesc").value = "";
  document.getElementById("txAmount").value = "";
  populateTxCategoryDropdown("Food");
  openModal("txModal");
};

window.openTxModalEdit = function (id) {
  const t = loadTx().find(x => x.id === id); if (!t) return;
  editingTxId = id; clearTxError();
  document.getElementById("txModalTitle").textContent = "Edit Transaction";
  document.getElementById("txSaveBtn").textContent = "Update";
  document.getElementById("txType").value = t.type;
  document.getElementById("txDate").value = t.date || new Date().toISOString().slice(0, 10);
  document.getElementById("txDesc").value = t.desc || "";
  document.getElementById("txAmount").value = Math.abs(Number(t.amount || 0));
  populateTxCategoryDropdown(t.category || "Other");
  openModal("txModal");
};

window.saveTransaction = function () {
  clearTxError();
  const type = document.getElementById("txType").value;
  const date = document.getElementById("txDate").value;
  const desc = (document.getElementById("txDesc").value || "").trim();
  const amountRaw = Number(document.getElementById("txAmount").value);
  if (!date || !desc || !Number.isFinite(amountRaw) || amountRaw <= 0) return txError("Please fill all fields with positive numbers.");

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
  } else { txs.push({ id: uid(), type, date, desc, amount: storedAmount, category }); }

  saveTx(txs);
  closeModal("txModal");
  populateFilterCategories(); // Safe update
  renderAll();
};

window.deleteTransaction = function (id) { saveTx(loadTx().filter(t => t.id !== id)); populateFilterCategories(); renderAll(); };

// --- Safe Dropdown Population ---
function populateFilterCategories() {
  const filterSel = document.getElementById("filterCategory"); if (!filterSel) return;
  const currentVal = filterSel.value;
  filterSel.innerHTML = '<option value="all">All categories</option>';
  const cats = getAllCategoryOptions(); 
  cats.forEach(c => { const opt = document.createElement("option"); opt.value = c.toLowerCase(); opt.textContent = c; filterSel.appendChild(opt); });
  if (currentVal && cats.map(c => c.toLowerCase()).includes(currentVal)) filterSel.value = currentVal;
}

// ===== 6. BUDGETS UI =====
function budError(msg) { const b = document.getElementById("budError"); if (b) { b.style.display = "block"; b.textContent = msg; } }
function clearBudError() { const b = document.getElementById("budError"); if (b) b.style.display = "none"; }

window.openBudgetModalAdd = function () {
  editingBudId = null; clearBudError();
  document.getElementById("budgetModalTitle").textContent = "New Budget";
  document.getElementById("budSaveBtn").textContent = "Save";
  document.getElementById("budCategory").value = "";
  document.getElementById("budLimit").value = "";
  openModal("budgetModal"); document.getElementById("budCategory").focus();
};

window.openBudgetModalEdit = function (id) {
  const b = loadBudgets().find(x => x.id === id); if (!b) return;
  editingBudId = id; clearBudError();
  document.getElementById("budgetModalTitle").textContent = "Edit Budget";
  document.getElementById("budSaveBtn").textContent = "Update";
  document.getElementById("budCategory").value = b.category;
  document.getElementById("budLimit").value = b.limit;
  openModal("budgetModal"); document.getElementById("budCategory").focus();
};

window.saveBudget = function () {
  clearBudError();
  const cat = (document.getElementById("budCategory").value || "").trim();
  const lim = Number(document.getElementById("budLimit").value);
  if (!cat || !Number.isFinite(lim) || lim < 0) return budError("Valid category and limit required.");

  let buds = loadBudgets();
  const existingBudget = buds.find(x => x.category.toLowerCase() === cat.toLowerCase());

  if (existingBudget) {
    existingBudget.limit = lim;
    if (editingBudId && editingBudId !== existingBudget.id) buds = buds.filter(x => x.id !== editingBudId);
  } else if (editingBudId) {
    const idx = buds.findIndex(x => x.id === editingBudId);
    if (idx >= 0) buds[idx] = { id: editingBudId, category: cat, limit: lim };
  } else { buds.push({ id: uid(), category: cat, limit: lim }); }

  saveBudgets(buds); closeModal("budgetModal"); renderAll();
};
window.deleteBudget = function (id) { saveBudgets(loadBudgets().filter(b => b.id !== id)); renderAll(); };

// ===== 7. RENDER ENGINE =====
window.renderAll = function() {
  if (isRendering) return;
  isRendering = true;

  try {
    const txs = loadTx();
    const buds = loadBudgets();
    const { income, expenses, savings, balance } = computeTotals(txs);
    
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("sum-income", money(income)); set("sum-expenses", money(expenses)); set("sum-savings", money(savings)); 
    set("sum-balance", money(balance)); set("side-balance", money(balance));

    const sidePctEl = document.getElementById("side-savings-pct");
    if (sidePctEl) sidePctEl.textContent = `${income > 0 ? Math.round((balance / income) * 100) : 0}% of income saved`;

    const cardPctEl = document.getElementById("sum-savings-pct");
    if (cardPctEl) cardPctEl.textContent = `${income > 0 ? Math.round((savings / income) * 100) : 0}% of income`;

    // 7A. Dashboard Recent
    const recentWrap = document.getElementById("recentList");
    if (recentWrap) {
      recentWrap.innerHTML = "";
      txs.slice().sort((a,b) => b.date.localeCompare(a.date)).slice(0, 5).forEach(t => {
        const isOutflow = (t.type === "expense" || t.type === "savings" || t.type === "investment");
        const row = document.createElement("div"); row.className = "tx-item";
        row.innerHTML = `<div class="tx-icon ${isOutflow ? 'bg-light-red' : 'bg-light-green'}">${isOutflow ? '🍔' : '💰'}</div>
          <div class="tx-info"><div class="tx-title">${escapeHtml(t.desc)}</div><div class="tx-date">${escapeHtml(t.category)} • ${t.date}</div></div>
          <div class="tx-meta"><div class="tx-amount ${isOutflow ? 'text-red' : 'text-green'}">${isOutflow ? '-' : '+'}${money(Math.abs(t.amount))}</div>
          <div class="tx-badge ${isOutflow ? 'badge-red' : 'badge-green'}">${t.type.toUpperCase()}</div></div>`;
        recentWrap.appendChild(row);
      });
    }

    // 7B. Transactions Page (WITH SAFE FILTERING)
    const allWrap = document.getElementById("allList");
    if (allWrap) {
      const searchInput = document.getElementById("searchTx");
      const typeSelect = document.getElementById("filterType");
      const catSelect = document.getElementById("filterCategory");
      
      const searchVal = searchInput ? searchInput.value.toLowerCase() : "";
      const typeVal = typeSelect ? typeSelect.value : "all";
      const catVal = catSelect ? catSelect.value : "all";

      let filteredTxs = txs.slice().sort((a,b) => (b.date || "").localeCompare(a.date || ""));
      if (searchVal) filteredTxs = filteredTxs.filter(t => (t.desc || "").toLowerCase().includes(searchVal) || (t.category || "").toLowerCase().includes(searchVal));
      if (typeVal !== "all") filteredTxs = filteredTxs.filter(t => t.type === typeVal);
      if (catVal !== "all") filteredTxs = filteredTxs.filter(t => (t.category || "").toLowerCase() === catVal);

      const txCountEl = document.getElementById("txCount");
      if (txCountEl) txCountEl.textContent = `${filteredTxs.length} transaction${filteredTxs.length !== 1 ? 's' : ''}`;

      allWrap.innerHTML = "";
      if (filteredTxs.length === 0) allWrap.innerHTML = "<div class='text-muted' style='padding: 32px; text-align: center;'>No transactions found.</div>";
      else {
        filteredTxs.forEach(t => {
          const isOutflow = (t.type === "expense" || t.type === "savings" || t.type === "investment");
          const row = document.createElement("div"); row.className = "tx-row";
          row.innerHTML = `<div class="col-desc"><div class="tx-icon ${isOutflow ? 'bg-light-red' : 'bg-light-green'}">${isOutflow ? '🍔' : '💰'}</div>
            <div class="tx-info"><div class="tx-title">${escapeHtml(t.desc)}</div><div class="tx-note">No notes</div></div></div>
            <div class="col-cat"><span class="badge-pill">${escapeHtml(t.category)}</span></div><div class="col-date">${t.date}</div>
            <div class="col-amt ${isOutflow ? 'text-red' : 'text-green'}">${isOutflow ? '-' : '+'}${money(Math.abs(t.amount))}</div>
            <div class="col-actions"><button type="button" class="icon-btn-small" onclick="window.openTxModalEdit('${t.id}')">📝</button>
            <button type="button" class="icon-btn-small" onclick="window.deleteTransaction('${t.id}')">🗑️</button></div>`;
          allWrap.appendChild(row);
        });
      }
    }

    // 7C. Budget Categories Dashboard
    const dashCatList = document.querySelector(".category-list");
    if (dashCatList && !document.getElementById("reportsChartWrap")) { 
      const spentMap = expenseByCategory(txs);
      const sortedCats = Array.from(spentMap.entries()).sort((a,b) => b[1] - a[1]).slice(0, 3);
      dashCatList.innerHTML = ""; 
      if(sortedCats.length === 0) dashCatList.innerHTML = "<div class='text-muted' style='padding: 16px 0;'>No expenses logged yet.</div>";
      else {
        sortedCats.forEach((item, index) => {
          const [cat, amt] = item; const pct = Math.round((amt / (expenses || 1)) * 100);
          const color = ["blue", "green", "red", "orange", "blue"][index % 5];
          dashCatList.innerHTML += `<div class="category-item"><div class="cat-icon bg-light-${color}">💰</div>
            <div class="cat-details"><div class="cat-header"><span class="cat-name">${escapeHtml(cat)}</span><span class="cat-amount">${money(amt)}</span></div>
            <div class="progress-bar"><div class="progress-fill fill-${color}" style="width: ${pct}%"></div></div></div></div>`;
        });
      }
    }

    // 7D. Budgets Page
    const budContainer = document.querySelector(".budget-list");
    if (budContainer) {
      const spentMap = expenseByCategory(txs);
      budContainer.innerHTML = "";
      buds.forEach(b => {
        let spent = 0; for (const [tCat, amt] of spentMap.entries()) { if (tCat.toLowerCase() === b.category.toLowerCase()) spent += amt; }
        const pct = b.limit > 0 ? Math.min(100, Math.round((spent/b.limit)*100)) : 0;
        const isOver = spent > b.limit; const isNear = !isOver && pct >= 90; 
        
        const card = document.createElement("div"); card.className = "budget-card";
        card.innerHTML = `<div class="bc-header"><div class="bc-title-group"><span>📊</span><span>${escapeHtml(b.category)}</span></div>
          <div class="bc-actions"><span class="tx-badge ${isOver ? 'badge-red' : (isNear ? 'badge-warning' : 'badge-green')}">${isOver ? 'Over budget' : (isNear ? 'Nearing limit' : 'On track')}</span>
          <button class="btn-close" onclick="window.deleteBudget('${b.id}')">✕</button></div></div>
          <div class="bc-sub">Monthly budget</div><div class="bc-amounts"><span class="bc-spent ${isOver ? 'text-red' : (isNear ? 'text-orange' : 'text-dark')}">${money(spent)}</span><span class="bc-limit">of ${money(b.limit)}</span></div>
          <div class="bc-progress"><div class="progress-fill ${isOver ? 'fill-red' : (isNear ? 'fill-orange' : 'fill-blue')}" style="width: ${pct}%"></div></div>
          <div class="bc-footer"><span>${isOver ? money(spent-b.limit) + ' over' : money(b.limit-spent) + ' remaining'}</span><span>${pct}%</span></div>`;
        budContainer.appendChild(card);
      });
    }

    // 7E. Reports Page
    const reportsChartWrap = document.getElementById("reportsChartWrap");
    if (reportsChartWrap) {
      const map = expenseByCategory(txs); const rows = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
      if (rows.length === 0) reportsChartWrap.innerHTML = `<div class="chart-empty">No expenses logged yet.</div>`;
      else {
        const colors = ["#ef4444", "#3b82f6", "#f59e0b", "#10b981", "#8b5cf6"];
        const total = rows.reduce((s, r) => s + r[1], 0);
        let stops = [], cur = 0, legendHtml = "";
        rows.forEach((item, i) => {
          const [cat, val] = item; const pct = (val / total) * 100; const color = colors[i % colors.length];
          stops.push(`${color} ${cur}% ${cur + pct}%`); cur += pct;
          legendHtml += `<div class="legend-item"><div class="legend-left"><div class="legend-color" style="background:${color}"></div><div class="legend-label">${escapeHtml(cat)}</div></div><div class="legend-val">${money(val)}</div></div>`;
        });
        reportsChartWrap.innerHTML = `<div class="pie-container"><div class="pie-chart" style="background:conic-gradient(${stops.join(",")})"></div><div class="pie-legend">${legendHtml}</div></div>`;
        
        const catListEl = document.getElementById("categoryTotalsList");
        if(catListEl) {
          catListEl.innerHTML = "";
          rows.forEach((item, index) => {
            const [cat, amt] = item; const pct = Math.round((amt / total) * 100); const colorClass = ["red", "blue", "orange", "green", "blue"][index % 5];
            catListEl.innerHTML += `<div class="category-item"><div class="cat-details"><div class="cat-header"><span class="cat-name">${escapeHtml(cat)}</span><span class="cat-amount">${money(amt)}</span></div><div class="progress-bar"><div class="progress-fill fill-${colorClass}" style="width: ${pct}%"></div></div></div></div>`;
          });
        }
      }
    }
  } finally {
    isRendering = false; // Guaranteed unlock
  }
};

// ===== 8. EXPORTS =====
window.exportToPDF = function() {
  const txs = loadTx(); if (txs.length === 0) return alert("No transactions to export!");
  const { jsPDF } = window.jspdf; const doc = new jsPDF();
  doc.setFontSize(18); doc.text("Freedom Finance Report", 14, 20); doc.setFontSize(11); doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);
  const tableRows = txs.map(t => [t.date, t.desc, t.category, t.type.toUpperCase(), `${t.type === "expense" ? "-" : "+"}${money(t.amount)}`]);
  doc.autoTable({ head: [["Date", "Description", "Category", "Type", "Amount"]], body: tableRows, startY: 35, theme: 'striped', headStyles: { fillColor: [59, 130, 246] } });
  doc.save(`Export_${new Date().toISOString().slice(0, 10)}.pdf`);
};

// ===== 9. SPARK AI =====
let rs = null, aiPipeline = null, LangchainPromptTemplate = null, isAiReady = false;
function initRiveScript() {
  if (typeof window.RiveScript === "undefined") return;
  rs = new window.RiveScript();
  rs.stream(`+ hello\n- Hi! I'm Spark ✨ How can I help?\n+ *\n- CALL_LLM`); rs.sortReplies();
}

window.toggleChat = function () {
  const win = document.getElementById("spark-chat-window"); if (!win) return;
  win.classList.toggle("hidden");
  if (!aiPipeline && !win.classList.contains("hidden")) initializeSparkAI();
};

window.handleSparkSend = async function () {
  const inputEl = document.getElementById("spark-input"); const message = inputEl.value.trim();
  if (!message) return; appendMessage("user", message); inputEl.value = "";
  let reply = "CALL_LLM";
  if (rs) try { reply = await rs.reply("local", message.toLowerCase()); } catch { reply = "CALL_LLM"; }
  if (reply === "CALL_LLM") {
    const tId = appendMessage("bot", "Thinking...");
    try { reply = await generateAIResponse(message); } catch { reply = "Sorry, I hit a snag!"; }
    document.getElementById(tId).innerText = reply;
  } else appendMessage("bot", reply);
};

async function initializeSparkAI() {
  const tId = appendMessage("bot", "Waking up AI...");
  try {
    const langchain = await import('https://esm.sh/@langchain/core@0.1.58/prompts?bundle'); LangchainPromptTemplate = langchain.PromptTemplate;
    const transformers = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers'); transformers.env.allowLocalModels = false;
    aiPipeline = await transformers.pipeline('text-generation', 'HuggingFaceTB/SmolLM-135M-Instruct');
    document.getElementById(tId).innerText = "Ready!"; isAiReady = true;
    document.getElementById("spark-input").disabled = false; document.getElementById("spark-send-btn").disabled = false;
  } catch { document.getElementById(tId).innerText = "Error loading AI."; }
}

async function generateAIResponse(userMessage) {
  if (!isAiReady) return "Still waking up!";
  const txs = loadTx(); const totals = computeTotals(txs);
  if (userMessage.includes("balance")) return `Balance: ${money(totals.balance)}`;
  return "I couldn't find a match. Try searching for an expense!";
}

function appendMessage(sender, text) {
  const cb = document.getElementById("spark-chat-body"); if (!cb) return null;
  const div = document.createElement("div"); div.className = "chat-msg " + sender; div.id = "msg-" + Date.now(); div.innerText = text;
  if (sender === "user") div.style.cssText = "background:var(--color-primary);color:#fff;align-self:flex-end;border-bottom-left-radius:12px;border-bottom-right-radius:4px;margin-left:auto;";
  cb.appendChild(div); cb.scrollTop = cb.scrollHeight; return div.id;
}

// ===== 10. BOOT SEQUENCE =====
document.addEventListener("DOMContentLoaded", () => {
  const dateEl = document.getElementById("current-date-display");
  if (dateEl) dateEl.textContent = `Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

  loadBudgets(); loadCategories(); populateFilterCategories(); renderAll(); initRiveScript();

  // SAFE EVENT LISTENERS (Guaranteed not to loop)
  const searchInput = document.getElementById("searchTx");
  if (searchInput) {
    searchInput.addEventListener("input", renderAll);
    searchInput.addEventListener("keypress", (e) => { if (e.key === "Enter") e.preventDefault(); });
  }
  const typeSelect = document.getElementById("filterType"); if (typeSelect) typeSelect.addEventListener("change", renderAll);
  const catSelect = document.getElementById("filterCategory"); if (catSelect) catSelect.addEventListener("change", renderAll);
  const sparkInput = document.getElementById("spark-input"); if (sparkInput) sparkInput.addEventListener("keypress", (e) => { if (e.key === "Enter") { e.preventDefault(); window.handleSparkSend(); }});
});
