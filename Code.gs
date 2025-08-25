/**
 * Google Apps Script backend for "The True Yoga — Member Manager"
 * HOW TO USE:
 * 1) In Google Drive, create a new Google Sheet and note its ID from the URL.
 * 2) Extensions → Apps Script. Replace Code.gs with this file.
 * 3) Set SHEET_ID below and (optionally) change SECRET.
 * 4) Deploy → New deployment → Web app → Who has access: Anyone.
 * 5) Copy the Web app URL and paste into script.js ENDPOINT.
 */

const SHEET_ID   = "PASTE_YOUR_SHEET_ID_HERE";
const SHEET_NAME = "Members";
const SECRET     = "CHANGE_ME";

const HEADERS = [
  "id","timestamp","name","imageUrl","address","contact","whatsapp",
  "dob","age","height","weight","medicalIssues","medicalOther",
  "package","packageLabel","price","joiningDate","expiryDate","lastRenewed"
];

/** Utilities **/
function _sheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  // Ensure headers
  const top = sh.getRange(1,1,1,HEADERS.length).getValues()[0];
  if (top.join("") !== HEADERS.join("")) {
    sh.clear();
    sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
  }
  return sh;
}

function _nowISO() {
  const tz = Session.getScriptTimeZone() || "Asia/Kolkata";
  return Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'HH:mm:ss'Z'");
}

function _toISO(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const tz = Session.getScriptTimeZone() || "Asia/Kolkata";
  return Utilities.formatDate(d, tz, "yyyy-MM-dd");
}

function _addMonths(iso, months) {
  if (!iso) return "";
  const d = new Date(iso);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) d.setDate(0);
  return _toISO(d);
}

function _calcAge(dobISO) {
  if (!dobISO) return "";
  const today = new Date();
  const dob = new Date(dobISO);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function _json(data, code) {
  const out = ContentService.createTextOutput(JSON.stringify(data));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

/** Handlers **/
function doGet(e) {
  try {
    const action = (e.parameter.action || "").toString();
    if (action === "listMembers") return listMembers_();
    if (action === "revenue")     return revenue_(e.parameter.secret || "");
    return _json({ok:false, error:"Unknown action"});
  } catch (err) {
    return _json({ok:false, error:String(err)});
  }
}

function doPost(e) {
  try {
    const body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const action = (body.action || "").toString();
    if (action === "createMember") return createMember_(body);
    if (action === "renewMember")  return renewMember_(body);
    return _json({ok:false, error:"Unknown action"});
  } catch (err) {
    return _json({ok:false, error:String(err)});
  }
}

function createMember_(p) {
  const sh = _sheet();
  const id = "M" + Date.now();
  const dob = _toISO(p.dob || "");
  const age = p.age || _calcAge(dob);
  // Allow auto compute expiry if not provided
  let expiry = p.expiryDate || "";
  if (!expiry && p.joinDate && p.package) {
    const months = { "1m":1,"2m":2,"3m":3,"6m":6,"12m":12 }[p.package] || 0;
    expiry = _addMonths(_toISO(p.joinDate), months);
  }
  const row = [
    id, _nowISO(), p.name||"", p.imageUrl||"", p.address||"", p.contact||"", p.whatsapp||"",
    dob, age||"", p.height||"", p.weight||"", p.medicalIssues||"", p.medicalOther||"",
    p.package||"", p.packageLabel||"", Number(p.price||0), _toISO(p.joinDate||""), _toISO(expiry||""), ""
  ];
  sh.appendRow(row);
  return _json({ok:true, id});
}

function renewMember_(p) {
  const sh = _sheet();
  const id = (p.id||"").toString();
  if (!id) return _json({ok:false, error:"Missing id"});
  const vals = sh.getDataRange().getValues();
  const idx = vals[0].indexOf("id");
  let rowIdx = -1;
  for (let r=1; r<vals.length; r++) {
    if (String(vals[r][idx]) === id) { rowIdx = r+1; break; }
  }
  if (rowIdx === -1) return _json({ok:false, error:"Member not found"});

  const months = { "1m":1,"2m":2,"3m":3,"6m":6,"12m":12 }[p.package] || 0;
  const today = _toISO(new Date());
  const newExpiry = _addMonths(today, months);

  const headerMap = Object.fromEntries(HEADERS.map((h,i)=>[h,i+1]));
  sh.getRange(rowIdx, headerMap["package"]).setValue(p.package||"");
  sh.getRange(rowIdx, headerMap["packageLabel"]).setValue(p.packageLabel||"");
  sh.getRange(rowIdx, headerMap["price"]).setValue(Number(p.price||0));
  sh.getRange(rowIdx, headerMap["expiryDate"]).setValue(newExpiry);
  sh.getRange(rowIdx, headerMap["lastRenewed"]).setValue(_toISO(new Date()));
  return _json({ok:true, id, newExpiry});
}

function listMembers_() {
  const sh = _sheet();
  const vals = sh.getDataRange().getValues();
  const header = vals.shift();
  const rows = vals.map(r => Object.fromEntries(header.map((h,i)=>[h, r[i]])));
  return _json({ok:true, rows});
}

function revenue_(secret) {
  if (String(secret) !== String(SECRET)) return _json({ok:false, error:"Forbidden"});
  const sh = _sheet();
  const vals = sh.getDataRange().getValues();
  const header = vals.shift();
  const priceIdx = header.indexOf("price");
  const total = vals.reduce((sum, r) => sum + Number(r[priceIdx]||0), 0);
  return _json({ok:true, total});
}
