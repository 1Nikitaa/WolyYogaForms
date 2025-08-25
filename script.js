// ======= CONFIG =======
// Replace with your Apps Script Web App URL after you deploy it.
const ENDPOINT = "https://script.google.com/macros/s/AKfycbzmfXEGNTrhuoSH-YLvDCnVcQ2EkLoMpDuLsNneUZfXUqEuO0JR23zqXrLpks60dK0hKQ/exec";
// Basic price list (you can change numbers below)
const PRICE_LIST = { "1m": 1000, "2m": 1800, "3m": 2600, "6m": 4800, "12m": 9000 };

// ======= UTILITIES =======
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function toISO(dateInput) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  const iso = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  return iso.toISOString().slice(0,10);
}

function addMonths(isoDate, months) {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) d.setDate(0); // month end adjust
  return toISO(d);
}

function calcAge(dobISO) {
  if (!dobISO) return "";
  const today = new Date();
  const dob = new Date(dobISO);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function daysFromToday(iso) {
  const today = new Date();
  const d = new Date(iso);
  const diff = Math.floor((d - new Date(toISO(today))) / (1000*60*60*24));
  return diff; // positive=future, 0=today, negative=past
}

function formatCard(m) {
  const exp = m.expiryDate ? ` | Expires: ${m.expiryDate}` : "";
  const pkg = m.packageLabel ? ` (${m.packageLabel})` : "";
  return `<li class="card"><strong>${m.name}</strong>${pkg}${exp}<br>
    Contact: ${m.contact || "-"} | ₹${m.price || 0}</li>`;
}

function packageLabel(code) {
  return ({ "1m":"1 month", "2m":"2 months", "3m":"3 months", "6m":"6 months", "12m":"1 year"})[code] || code;
}

// ======= MEDICAL TAGS =======
const MEDICAL_TAGS = [
  "asthma","back pain","diabetes","hypertension","migraine","neck pain","knee pain","arthritis",
  "thyroid","PCOS","PCOD","depression","anxiety","insomnia","sciatica","spondylitis","obesity",
  "high cholesterol","low blood pressure","slip disc","plantar fasciitis","shoulder pain","tennis elbow"
];

function renderMedicalTags(filter="") {
  const list = $("#medicalList");
  if (!list) return;
  
  list.innerHTML = "";
  const selInput = $("#medicalSelectedText");
  const selected = new Set(selInput.value.split(",").map(s => s.trim()).filter(Boolean));
  
  MEDICAL_TAGS
    .filter(t => t.toLowerCase().includes(filter.toLowerCase()))
    .forEach(tag => {
      const li = document.createElement("li");
      li.className = "tag" + (selected.has(tag) ? " on": "");
      li.textContent = tag;
      li.onclick = () => {
        if (selected.has(tag)) {
          selected.delete(tag);
          li.classList.remove("on");
        } else {
          selected.add(tag);
          li.classList.add("on");
        }
        selInput.value = Array.from(selected).join(", ");
      };
      list.appendChild(li);
    });
}

// ======= TABS =======
function initTabs() {
  $$(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      // Remove active class from all tabs and buttons
      $$(".tab-btn").forEach(b => b.classList.remove("active"));
      $$(".tab").forEach(t => t.classList.remove("active"));
      
      // Add active class to clicked button
      btn.classList.add("active");
      
      // Show corresponding tab
      const targetTab = $("#tab-" + btn.dataset.tab);
      if (targetTab) {
        targetTab.classList.add("active");
      }
    });
  });
}

// ======= ADD MEMBER =======
function initAddMember() {
  const dobField = $("#dob");
  const packageField = $("#package");
  const joinDateField = $("#joinDate");
  const medicalSearchField = $("#medicalSearch");
  const addForm = $("#addMemberForm");

  if (dobField) {
    dobField.addEventListener("change", (e) => { 
      const ageField = $("#age");
      if (ageField) {
        ageField.value = calcAge(e.target.value) || ""; 
      }
    });
  }

  if (packageField) {
    packageField.addEventListener("change", updateExpiryAndPrice);
  }

  if (joinDateField) {
    joinDateField.addEventListener("change", updateExpiryAndPrice);
  }

  if (medicalSearchField) {
    medicalSearchField.addEventListener("input", (e) => renderMedicalTags(e.target.value));
  }

  if (addForm) {
    addForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const statusEl = $("#addStatus");
      if (statusEl) statusEl.textContent = "Saving...";
      
      const fd = new FormData(e.target);
      const payload = Object.fromEntries(fd.entries());
      // Normalize
      payload.action = "createMember";
      if (payload.dob) payload.age = calcAge(payload.dob);
      if (payload.package) payload.packageLabel = packageLabel(payload.package);
      
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.ok) {
          if (statusEl) statusEl.textContent = "✅ Member saved!";
          e.target.reset();
          renderMedicalTags("");
        } else {
          if (statusEl) statusEl.textContent = "❌ " + (data.error || "Error");
        }
      } catch (err) {
        if (statusEl) statusEl.textContent = "Network error";
      }
    });
  }
}

function updateExpiryAndPrice() {
  const packageField = $("#package");
  const joinDateField = $("#joinDate");
  const priceField = $("#price");
  const expiryField = $("#expiryDate");
  
  if (!packageField || !joinDateField) return;
  
  const p = packageField.value;
  const join = joinDateField.value;
  
  if (p && join) {
    const months = {"1m":1,"2m":2,"3m":3,"6m":6,"12m":12}[p] || 0;
    if (expiryField) {
      expiryField.value = addMonths(join, months);
    }
    if (priceField && !priceField.value) {
      priceField.value = PRICE_LIST[p] || 0;
    }
  }
}

// ======= RENEW =======
function initRenew() {
  const renewPackageField = $("#renewPackage");
  const renewMemberField = $("#renewForm #renewMemberId");
  const renewForm = $("#renewForm");

  if (renewPackageField) {
    renewPackageField.addEventListener("change", updateRenewExpiryPrice);
  }

  if (renewMemberField) {
    renewMemberField.addEventListener("change", updateRenewExpiryPrice);
  }

  if (renewForm) {
    renewForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const statusEl = $("#renewStatus");
      if (statusEl) statusEl.textContent = "Saving...";
      
      const fd = new FormData(e.target);
      const payload = Object.fromEntries(fd.entries());
      payload.action = "renewMember";
      payload.packageLabel = packageLabel(payload.package);
      
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.ok) {
          if (statusEl) statusEl.textContent = "✅ Renewal saved!";
          loadMembers();
        } else {
          if (statusEl) statusEl.textContent = "❌ " + (data.error || "Error");
        }
      } catch (err) {
        if (statusEl) statusEl.textContent = "Network error";
      }
    });
  }
}

function updateRenewExpiryPrice() {
  const renewPackageField = $("#renewPackage");
  const renewPriceField = $("#renewPrice");
  const renewExpiryField = $("#renewExpiry");
  
  if (!renewPackageField) return;
  
  const p = renewPackageField.value;
  const months = {"1m":1,"2m":2,"3m":3,"6m":6,"12m":12}[p] || 0;
  if (!p) return;
  
  const today = toISO(new Date());
  if (renewExpiryField) {
    renewExpiryField.value = addMonths(today, months);
  }
  if (renewPriceField && !renewPriceField.value) {
    renewPriceField.value = PRICE_LIST[p] || 0;
  }
}

// ======= DASHBOARD =======
function initDashboard() {
  const refreshBtn = $("#refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadMembers);
  }
}

async function loadMembers() {
  const statusEl = $("#loadStatus");
  if (statusEl) statusEl.textContent = "Loading...";
  
  // GET list
  try {
    const res = await fetch(`${ENDPOINT}?action=listMembers`);
    const data = await res.json();
    if (!data.ok) {
      if (statusEl) statusEl.textContent = "❌ " + (data.error || "Error");
      return;
    }
    const list = data.rows || [];
    
    // Fill renew dropdown
    const renewSel = $("#renewMemberId");
    if (renewSel) {
      renewSel.innerHTML = '<option value="" disabled selected>Select member</option>';
      list.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = `${m.name} (${m.contact})`;
        renewSel.appendChild(opt);
      });
    }
    
    // Dashboard logic
    updateDashboard(list);
    
    if (statusEl) statusEl.textContent = `✅ ${list.length} members loaded`;
  } catch (e) {
    if (statusEl) statusEl.textContent = "Network error";
  }
}

function updateDashboard(members) {
  const counts = {
    expiring3: [],
    expiring7: [],
    expired1: [],
    expired7: [],
    expired30: [],
    expiredMore: []
  };
  
  members.forEach(m => {
    if (!m.expiryDate) return;
    const days = daysFromToday(m.expiryDate);
    
    if (days <= 3 && days >= 0) counts.expiring3.push(m);
    else if (days <= 7 && days >= 0) counts.expiring7.push(m);
    else if (days >= -1 && days < 0) counts.expired1.push(m);
    else if (days >= -7 && days < 0) counts.expired7.push(m);
    else if (days >= -30 && days < 0) counts.expired30.push(m);
    else if (days < -30) counts.expiredMore.push(m);
  });
  
  // Update counts
  const countsEl = $("#counts");
  if (countsEl) {
    countsEl.innerHTML = `
      <div class="pill">Total: ${members.length}</div>
      <div class="pill">Expiring Soon: ${counts.expiring3.length + counts.expiring7.length}</div>
      <div class="pill">Expired: ${counts.expired1.length + counts.expired7.length + counts.expired30.length + counts.expiredMore.length}</div>
    `;
  }
  
  // Update boards
  Object.keys(counts).forEach(key => {
    const el = $(`#${key.replace('expiring', 'expiring').replace('expired', 'expired')}`);
    if (el) {
      el.innerHTML = counts[key].length ? 
        counts[key].map(formatCard).join('') : 
        '<li class="muted">No members in this category</li>';
    }
  });
}

// ======= ADMIN / REVENUE =======
function initAdmin() {
  const revenueBtn = $("#revenueBtn");
  if (revenueBtn) {
    revenueBtn.addEventListener("click", async () => {
      const pwd = $("#adminPassword").value.trim();
      const revenueEl = $("#revenue");
      
      if (!pwd) {
        alert("Please enter admin password");
        return;
      }
      
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({action: "getRevenue", password: pwd}),
        });
        const data = await res.json();
        
        if (data.ok && revenueEl) {
          revenueEl.textContent = `Total Revenue: ₹${data.revenue || 0}`;
        } else if (revenueEl) {
          revenueEl.textContent = "❌ " + (data.error || "Access denied");
        }
      } catch (e) {
        const revenueEl = $("#revenue");
        if (revenueEl) revenueEl.textContent = "Network error";
      }
    });
  }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function() {
  // Initialize all components
  initTabs();
  initAddMember();
  initRenew();
  initDashboard();
  initAdmin();
  
  // Render medical tags
  renderMedicalTags("");
  
  // Load members
  loadMembers();
});
