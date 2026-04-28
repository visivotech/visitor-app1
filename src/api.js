// API client for the Google Apps Script Web App.
//
// Apps Script Web Apps allow simple cross-origin requests but DO NOT handle
// CORS preflights, so we POST with Content-Type: text/plain (a "simple
// request" in CORS terms) and parse JSON on the server side.

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  console.warn('VITE_API_URL is not set. Set it in .env.local or in Amplify env variables.');
}

async function request(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export function fetchHosts() {
  return request(`${API_URL}?action=hosts`);
}

export function fetchActiveVisitors() {
  return request(`${API_URL}?action=active`);
}

export function signIn({ name, phone, reason, host, vehicle }) {
  return request(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'signin', name, phone, reason, host, vehicle }),
  });
}

export function signOut({ name }) {
  return request(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'signout', name }),
  });
}
