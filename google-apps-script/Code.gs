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
const COMPANY_NAME = 'Gen II';                 // shown in email signature
// ───────────────────────────────────────────────────────────────────────────

// Visitors columns: Name | Phone | Reason | Vehicle Reg | Host | Date | Arrival | Departure
const COL = {
  NAME: 0, PHONE: 1, REASON: 2, VEHICLE: 3, HOST: 4, DATE: 5, ARRIVAL: 6, DEPARTURE: 7,
};
const NUM_COLS = 8;


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
  const values = sheet.getRange(2, 1, lastRow - 1, NUM_COLS).getValues();
  const today = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');

  const visitors = values
    .map(r => ({
      name: String(r[COL.NAME] || '').trim(),
      host: String(r[COL.HOST] || '').trim(),
      date: r[COL.DATE] instanceof Date
        ? Utilities.formatDate(r[COL.DATE], TIMEZONE, 'yyyy-MM-dd')
        : String(r[COL.DATE] || '').trim(),
      arrival: String(r[COL.ARRIVAL] || '').trim(),
      departure: String(r[COL.DEPARTURE] || '').trim(),
    }))
    .filter(v => v.name && v.date === today && !v.departure)
    .map(v => ({ name: v.name, host: v.host, arrival: v.arrival }));

  return { ok: true, visitors };
}

function signIn(body) {
  const name = (body.name || '').trim();
  const phone = (body.phone || '').trim();
  const reason = (body.reason || '').trim();
  const host = (body.host || '').trim();
  const vehicle = (body.vehicle || '').trim().toUpperCase();
  if (!name || !phone || !reason || !host) {
    return { ok: false, error: 'Please fill in all required fields.' };
  }

  const now = new Date();
  const dateStr = Utilities.formatDate(now, TIMEZONE, 'yyyy-MM-dd');
  const timeStr = Utilities.formatDate(now, TIMEZONE, 'HH:mm');

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(VISITORS_TAB);
  // Order MUST match COL: Name | Phone | Reason | Vehicle | Host | Date | Arrival | Departure
  // Prefix phone with apostrophe so Sheets keeps leading zeros and treats as text.
  sheet.appendRow([name, "'" + phone, reason, vehicle, host, dateStr, timeStr, '']);

  const emailSent = notifyHost(host, name, phone, reason, vehicle, timeStr);
  return { ok: true, emailSent };
}

function signOut(body) {
  const name = (body.name || '').trim();
  if (!name) return { ok: false, error: 'Please enter your name.' };

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(VISITORS_TAB);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: false, error: 'No active visitors found.' };

  const values = sheet.getRange(2, 1, lastRow - 1, NUM_COLS).getValues();
  const today = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');

  // Walk from bottom to find most-recent active sign-in for this name today.
  let targetRow = -1;
  for (let i = values.length - 1; i >= 0; i--) {
    const r = values[i];
    const rowDate = r[COL.DATE] instanceof Date
      ? Utilities.formatDate(r[COL.DATE], TIMEZONE, 'yyyy-MM-dd')
      : String(r[COL.DATE] || '').trim();
    const rowName = String(r[COL.NAME] || '').trim().toLowerCase();
    const departure = String(r[COL.DEPARTURE] || '').trim();
    if (rowName === name.toLowerCase() && rowDate === today && !departure) {
      targetRow = i + 2; // +2 because sheet is 1-indexed and we skipped header
      break;
    }
  }

  if (targetRow < 0) {
    return { ok: false, error: `We couldn't find an active sign-in for "${name}" today.` };
  }

  const timeStr = Utilities.formatDate(new Date(), TIMEZONE, 'HH:mm');
  // Departure is column index 7 → sheet column H (8)
  sheet.getRange(targetRow, COL.DEPARTURE + 1).setValue(timeStr);
  return { ok: true };
}

// ───── Email ───────────────────────────────────────────────────────────────

function notifyHost(hostName, visitorName, phone, reason, vehicle, arrivalTime) {
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
    const vehicleLine = vehicle ? `\n    Vehicle:  ${vehicle}` : '';
    const body =
`Hi ${firstName},

Your visitor has just signed in at reception:

    Visitor:  ${visitorName}
    Phone:    ${phone}
    Reason:   ${reason}${vehicleLine}
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

/**
 * Run this once after pasting the script.
 * Safe to re-run — it inserts any missing columns (Phone, Vehicle Reg) into
 * existing Visitors tabs without disturbing the rows you already have.
 */
function setupSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // Hosts tab
  let h = ss.getSheetByName(HOSTS_TAB);
  if (!h) h = ss.insertSheet(HOSTS_TAB);
  if (h.getLastRow() === 0) {
    h.appendRow(['Name', 'Email']);
    h.getRange('A1:B1').setFontWeight('bold');
    h.setFrozenRows(1);
    h.appendRow(['Jane Smith', 'jane@example.com']);
    h.appendRow(['Ahmed Patel', 'ahmed@example.com']);
  }

  // Visitors tab
  let v = ss.getSheetByName(VISITORS_TAB);
  if (!v) v = ss.insertSheet(VISITORS_TAB);

  if (v.getLastRow() === 0) {
    // Brand-new sheet — write full headers
    v.appendRow(['Name', 'Phone', 'Reason', 'Vehicle Reg', 'Host', 'Date', 'Arrival', 'Departure']);
    v.getRange('A1:H1').setFontWeight('bold');
    v.setFrozenRows(1);
    v.getRange('B:B').setNumberFormat('@'); // store phone as plain text
    return;
  }

  // Existing sheet — insert any missing columns. Re-read headers between
  // operations because column positions shift after each insert.
  function headersLower() {
    return v.getRange(1, 1, 1, v.getLastColumn())
      .getValues()[0]
      .map(s => String(s).trim().toLowerCase());
  }

  // Insert Phone right after Name (column B / position 2) if missing.
  if (headersLower().indexOf('phone') === -1) {
    v.insertColumnBefore(2);
    v.getRange(1, 2).setValue('Phone').setFontWeight('bold');
    v.getRange('B:B').setNumberFormat('@');
    Logger.log('Added Phone column.');
  }

  // Insert Vehicle Reg right after Reason if missing.
  let hdrs = headersLower();
  if (hdrs.indexOf('vehicle reg') === -1) {
    const reasonIdx = hdrs.indexOf('reason');
    const insertAt = reasonIdx >= 0 ? reasonIdx + 2 : 4; // 1-indexed sheet position
    v.insertColumnBefore(insertAt);
    v.getRange(1, insertAt).setValue('Vehicle Reg').setFontWeight('bold');
    Logger.log('Added Vehicle Reg column.');
  }
}
