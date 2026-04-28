/**
 * Visitor Registration — Google Apps Script backend
 * ---------------------------------------------------
 * Deploy this as a Web App (Deploy ▸ New deployment ▸ Web app).
 * - Execute as: Me
 * - Who has access: Anyone
 * Copy the resulting /exec URL into the React app's VITE_API_URL.
 */

// ───── CONFIG ──────────────────────────────────────────────────────────────
const SHEET_ID = 'REPLACE_WITH_YOUR_SHEET_ID'; // the long string in the Sheet URL
const TIMEZONE = 'Europe/London';              // change if needed
const VISITORS_TAB = 'Visitors';
const HOSTS_TAB = 'Hosts';
const COMPANY_NAME = 'Reception';              // shown in email signature
// ───────────────────────────────────────────────────────────────────────────


/** GET endpoint — used by the app to load dropdowns & active visitors. */
function doGet(e) {
  try {
    const action = ((e && e.parameter && e.parameter.action) || '').toLowerCase();
    if (action === 'hosts')  return jsonOut(getHosts());
    if (action === 'active') return jsonOut(getActiveVisitors());
    return jsonOut({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

/** POST endpoint — handles sign-in and sign-out. */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = (body.action || '').toLowerCase();
    if (action === 'signin')  return jsonOut(signIn(body));
    if (action === 'signout') return jsonOut(signOut(body));
    return jsonOut({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

// ───── Handlers ────────────────────────────────────────────────────────────

function getHosts() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(HOSTS_TAB);
  if (!sheet) throw new Error(`Tab "${HOSTS_TAB}" not found`);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: true, hosts: [] };
  const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const hosts = values
    .filter(r => r[0])
    .map(r => ({ name: String(r[0]).trim(), email: String(r[1] || '').trim() }));
  return { ok: true, hosts };
}

function getActiveVisitors() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(VISITORS_TAB);
  if (!sheet) throw new Error(`Tab "${VISITORS_TAB}" not found`);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: true, visitors: [] };
  const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  const today = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');

  const visitors = values
    .map(r => ({
      name: String(r[0] || '').trim(),
      reason: String(r[1] || '').trim(),
      host: String(r[2] || '').trim(),
      date: r[3] instanceof Date
        ? Utilities.formatDate(r[3], TIMEZONE, 'yyyy-MM-dd')
        : String(r[3] || '').trim(),
      arrival: String(r[4] || '').trim(),
      departure: String(r[5] || '').trim(),
    }))
    .filter(v => v.name && v.date === today && !v.departure)
    .map(v => ({ name: v.name, host: v.host, arrival: v.arrival }));

  return { ok: true, visitors };
}

function signIn(body) {
  const name = (body.name || '').trim();
  const reason = (body.reason || '').trim();
  const host = (body.host || '').trim();
  if (!name || !reason || !host) {
    return { ok: false, error: 'Please fill in all fields.' };
  }

  const now = new Date();
  const dateStr = Utilities.formatDate(now, TIMEZONE, 'yyyy-MM-dd');
  const timeStr = Utilities.formatDate(now, TIMEZONE, 'HH:mm');

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(VISITORS_TAB);
  sheet.appendRow([name, reason, host, dateStr, timeStr, '']);

  const emailSent = notifyHost(host, name, reason, timeStr);
  return { ok: true, emailSent };
}

function signOut(body) {
  const name = (body.name || '').trim();
  if (!name) return { ok: false, error: 'Please enter your name.' };

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(VISITORS_TAB);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: false, error: 'No active visitors found.' };

  const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  const today = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');

  // Walk from bottom to find most-recent active sign-in for this name today.
  let targetRow = -1;
  for (let i = values.length - 1; i >= 0; i--) {
    const r = values[i];
    const rowDate = r[3] instanceof Date
      ? Utilities.formatDate(r[3], TIMEZONE, 'yyyy-MM-dd')
      : String(r[3] || '').trim();
    const rowName = String(r[0] || '').trim().toLowerCase();
    const departure = String(r[5] || '').trim();
    if (rowName === name.toLowerCase() && rowDate === today && !departure) {
      targetRow = i + 2; // +2 because sheet is 1-indexed and we skipped header
      break;
    }
  }

  if (targetRow < 0) {
    return { ok: false, error: `We couldn't find an active sign-in for "${name}" today.` };
  }

  const timeStr = Utilities.formatDate(new Date(), TIMEZONE, 'HH:mm');
  sheet.getRange(targetRow, 6).setValue(timeStr);
  return { ok: true };
}

// ───── Email ───────────────────────────────────────────────────────────────

function notifyHost(hostName, visitorName, reason, arrivalTime) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(HOSTS_TAB);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return false;
    const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    const match = values.find(r =>
      String(r[0] || '').trim().toLowerCase() === hostName.toLowerCase()
    );
    if (!match || !match[1]) return false;

    const email = String(match[1]).trim();
    const firstName = hostName.split(' ')[0];
    const subject = `${visitorName} has arrived at reception`;
    const body =
`Hi ${firstName},

Your visitor has just signed in at reception:

    Visitor:  ${visitorName}
    Reason:   ${reason}
    Arrived:  ${arrivalTime}

— ${COMPANY_NAME}`;

    MailApp.sendEmail({ to: email, subject, body });
    return true;
  } catch (err) {
    console.error('notifyHost failed:', err);
    return false;
  }
}

// ───── Helpers ─────────────────────────────────────────────────────────────

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Run this once from the Apps Script editor to auto-create the tabs & headers.
function setupSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let v = ss.getSheetByName(VISITORS_TAB);
  if (!v) v = ss.insertSheet(VISITORS_TAB);
  if (v.getLastRow() === 0) {
    v.appendRow(['Name', 'Reason', 'Host', 'Date', 'Arrival', 'Departure']);
    v.getRange('A1:F1').setFontWeight('bold');
    v.setFrozenRows(1);
  }
  let h = ss.getSheetByName(HOSTS_TAB);
  if (!h) h = ss.insertSheet(HOSTS_TAB);
  if (h.getLastRow() === 0) {
    h.appendRow(['Name', 'Email']);
    h.getRange('A1:B1').setFontWeight('bold');
    h.setFrozenRows(1);
    h.appendRow(['Jane Smith', 'jane@example.com']);
    h.appendRow(['Ahmed Patel', 'ahmed@example.com']);
  }
}
