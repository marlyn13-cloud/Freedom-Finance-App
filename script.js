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

function openModal(id){
  const el = document.getElementById(id);
  if(el) el.style.display = "flex";
}
function closeModal(id){
  const el = document.getElementById(id);
  if(el) el.style.display = "none";
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
//==Sign up feature==
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

  const usernameExists = users.some(u => u.username.toLowerCase() === username.toLowerCase());
  if(usernameExists) return showAuthError("signupError", "That username already exists.");

  const emailExists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
  if(emailExists) return showAuthError("signupError", "That email is already registered.");

  users.push({
    id: uid(),
    username,
    email,
    password
  });

  saveUsers(users);

  const loginIdentifier = document.getElementById("loginIdentifier");
  const loginPassword = document.getElementById("loginPassword");

  if(loginIdentifier) loginIdentifier.value = email;
  if(loginPassword) loginPassword.value = "";

  showAuthView("login");
}
//login sample database(web storage)
function handleLogin(){
  clearAuthMessages();

  const identifier = (document.getElementById("loginIdentifier")?.value || "").trim().toLowerCase();
  const password = document.getElementById("loginPassword")?.value || "";

  if(!identifier) return showAuthError("loginError", "Enter your username or email.");
  if(!password) return showAuthError("loginError", "Enter your password.");

  const users = loadUsers();
  const user = users.find(u =>
    u.email.toLowerCase() === identifier || u.username.toLowerCase() === identifier
  );

  if(!user) return showAuthError("loginError", "Account not found.");
  if(user.password !== password) return showAuthError("loginError", "Incorrect password.");

  setCurrentUser({
    id: user.id,
    username: user.username,
    email: user.email
  });

  window.location.href = "dashboard.html";
}

//logout function
window.logoutUser = function() {
  clearCurrentUser();
  window.location.href = "index.html";
}

function requireAuth(){
  const authPage = document.getElementById("authPage");
  if(authPage) return; // Don't redirect when already on login page

  const currentUser = getCurrentUser();
  if(!currentUser){
    window.location.href = "index.html";
  }
}