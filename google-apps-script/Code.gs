/**
 * Visitor Registration — Google Apps Script backend
 * ---------------------------------------------------
 * Saluto · saluto.space
 *
 * Deploy as a Web App (Deploy ▸ New deployment ▸ Web app):
 *   - Execute as: Me
 *   - Who has access: Anyone
 *
 * Required Script Properties (Project Settings ▸ Script properties):
 *   - RESEND_API_KEY : starts with "re_..." (from resend.com)
 *   - FROM_EMAIL     : e.g. hello@saluto.space
 * Optional Script Properties:
 *   - REPLY_TO       : real human email for hosts who hit reply
 *                      (defaults to FROM_EMAIL if not set)
 */

// ───── CONFIG ──────────────────────────────────────────────────────────────
const SHEET_ID = 'REPLACE_WITH_YOUR_SHEET_ID'; // the long string in the Sheet URL
const TIMEZONE = 'Europe/London';              // change if needed
const VISITORS_TAB = 'Visitors';
const HOSTS_TAB = 'Hosts';
const COMPANY_NAME = 'Gen II';                 // shown in email body/signature
const FROM_NAME = 'Saluto';                    // shown as the sender name
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
  // Prefix phone with apostrophe so Sheets treats it as text (preserves leading zeros).
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
      targetRow = i + 2;
      break;
    }
  }

  if (targetRow < 0) {
    return { ok: false, error: `We couldn't find an active sign-in for "${name}" today.` };
  }

  const timeStr = Utilities.formatDate(new Date(), TIMEZONE, 'HH:mm');
  sheet.getRange(targetRow, COL.DEPARTURE + 1).setValue(timeStr);
  return { ok: true };
}

// ───── Email (Resend → MailApp fallback) ──────────────────────────────────

/**
 * Sends the host an arrival notification.
 * Tries Resend first (proper SPF/DKIM/DMARC, from your domain).
 * Falls back to MailApp.sendEmail if Resend is unavailable, so a Resend
 * outage never blocks a sign-in.
 */
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
    const plainBody =
`Hi ${firstName},

Your visitor has just signed in at reception:

    Visitor:  ${visitorName}
    Phone:    ${phone}
    Reason:   ${reason}${vehicleLine}
    Arrived:  ${arrivalTime}

— ${COMPANY_NAME} Reception
Powered by Saluto · saluto.space`;

    const htmlBody = buildHtmlEmail({
      firstName, visitorName, phone, reason, vehicle, arrivalTime,
    });

    // Try Resend first
    const resendOk = sendViaResend({
      to: email,
      subject,
      text: plainBody,
      html: htmlBody,
    });
    if (resendOk) return true;

    // Fallback: MailApp (sends from your Google account)
    Logger.log('Resend failed, falling back to MailApp for ' + email);
    MailApp.sendEmail({ to: email, subject, body: plainBody, htmlBody });
    return true;

  } catch (err) {
    console.error('notifyHost failed:', err);
    return false;
  }
}

/** POSTs to Resend's API. Returns true on 200, false otherwise. */
function sendViaResend({ to, subject, text, html }) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('RESEND_API_KEY');
  const fromEmail = props.getProperty('FROM_EMAIL');
  const replyTo = props.getProperty('REPLY_TO') || fromEmail;

  if (!apiKey || !fromEmail) {
    Logger.log('Resend not configured (missing RESEND_API_KEY or FROM_EMAIL).');
    return false;
  }

  const payload = {
    from: `${FROM_NAME} <${fromEmail}>`,
    to: [to],
    subject,
    text,
    html,
  };
  // Only set reply_to if it actually differs from the From address.
  if (replyTo && replyTo.toLowerCase() !== fromEmail.toLowerCase()) {
    payload.reply_to = replyTo;
  }

  try {
    const res = UrlFetchApp.fetch('https://api.resend.com/emails', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + apiKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    const code = res.getResponseCode();
    if (code >= 200 && code < 300) {
      Logger.log('Resend OK → ' + to);
      return true;
    }
    Logger.log('Resend error ' + code + ': ' + res.getContentText());
    return false;
  } catch (err) {
    Logger.log('Resend request threw: ' + err);
    return false;
  }
}

/** Simple branded HTML version of the host email. */
function buildHtmlEmail({ firstName, visitorName, phone, reason, vehicle, arrivalTime }) {
  const safe = (s) => String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const vehicleRow = vehicle
    ? `<tr><td style="padding:6px 0;color:#6B6B6B;width:90px;">Vehicle</td><td style="padding:6px 0;color:#0F172A;font-weight:500;">${safe(vehicle)}</td></tr>`
    : '';

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#F4F7FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0F172A;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #E2E8F0;border-radius:12px;">
    <tr><td style="padding:28px 32px;">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#00A7E1;font-weight:600;">Reception</p>
      <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#0F172A;font-weight:700;">Your visitor has arrived</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#404040;">Hi ${safe(firstName)}, ${safe(visitorName)} has just signed in at reception.</p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:14px;border-top:1px solid #EDF2F7;margin-top:8px;">
        <tr><td style="padding:14px 0 6px;color:#6B6B6B;width:90px;">Visitor</td><td style="padding:14px 0 6px;color:#0F172A;font-weight:500;">${safe(visitorName)}</td></tr>
        <tr><td style="padding:6px 0;color:#6B6B6B;">Phone</td><td style="padding:6px 0;color:#0F172A;font-weight:500;">${safe(phone)}</td></tr>
        <tr><td style="padding:6px 0;color:#6B6B6B;">Reason</td><td style="padding:6px 0;color:#0F172A;font-weight:500;">${safe(reason)}</td></tr>
        ${vehicleRow}
        <tr><td style="padding:6px 0 14px;color:#6B6B6B;">Arrived</td><td style="padding:6px 0 14px;color:#0F172A;font-weight:500;">${safe(arrivalTime)}</td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:16px 32px;border-top:1px solid #EDF2F7;font-size:12px;color:#6B6B6B;">
      ${safe(COMPANY_NAME)} Reception · powered by <a href="https://saluto.space" style="color:#00A7E1;text-decoration:none;">Saluto</a>
    </td></tr>
  </table>
</body></html>`;
}

// ───── Helpers ─────────────────────────────────────────────────────────────

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Run this once after pasting the script.
 * Safe to re-run — inserts any missing columns without disturbing existing rows.
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
    v.appendRow(['Name', 'Phone', 'Reason', 'Vehicle Reg', 'Host', 'Date', 'Arrival', 'Departure']);
    v.getRange('A1:H1').setFontWeight('bold');
    v.setFrozenRows(1);
    v.getRange('B:B').setNumberFormat('@');
    return;
  }

  function headersLower() {
    return v.getRange(1, 1, 1, v.getLastColumn())
      .getValues()[0]
      .map(s => String(s).trim().toLowerCase());
  }

  if (headersLower().indexOf('phone') === -1) {
    v.insertColumnBefore(2);
    v.getRange(1, 2).setValue('Phone').setFontWeight('bold');
    v.getRange('B:B').setNumberFormat('@');
    Logger.log('Added Phone column.');
  }

  let hdrs = headersLower();
  if (hdrs.indexOf('vehicle reg') === -1) {
    const reasonIdx = hdrs.indexOf('reason');
    const insertAt = reasonIdx >= 0 ? reasonIdx + 2 : 4;
    v.insertColumnBefore(insertAt);
    v.getRange(1, insertAt).setValue('Vehicle Reg').setFontWeight('bold');
    Logger.log('Added Vehicle Reg column.');
  }
}

/**
 * Run this once to verify your Resend setup.
 * Sends a test email to the address you put in TEST_TO below.
 * Check the Apps Script logs (View ▸ Logs) for the result.
 */
function testResend() {
  const TEST_TO = 'your-own-email@example.com'; // ← change this before running

  const html = buildHtmlEmail({
    firstName: 'Test',
    visitorName: 'Saluto Test Visitor',
    phone: '07000 000 000',
    reason: 'Verifying email delivery',
    vehicle: 'TEST 1',
    arrivalTime: Utilities.formatDate(new Date(), TIMEZONE, 'HH:mm'),
  });

  const ok = sendViaResend({
    to: TEST_TO,
    subject: 'Saluto · test email',
    text: 'If you can read this, Resend is working.',
    html,
  });
  Logger.log(ok ? 'Test email sent. Check the inbox.' : 'Test email FAILED. See logs above.');
}
