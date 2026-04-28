import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchActiveVisitors, signOut } from '../api';

export default function SignOut({ onDone, onBack }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [focused, setFocused] = useState(false);
  const [cursor, setCursor] = useState(0);
  const wrapRef = useRef(null);

  useEffect(() => {
    fetchActiveVisitors()
      .then(d => setActive(d.visitors || []))
      .catch(err => setError('Could not load today\'s visitors. ' + err.message))
      .finally(() => setLoading(false));
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setFocused(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return active;
    return active.filter(v => v.name.toLowerCase().includes(q));
  }, [query, active]);

  async function handleSignOut(name) {
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await signOut({ name: name.trim() });
      onDone({ name: name.trim() });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    // If user typed something matching exactly one active visitor, use that.
    const exact = active.find(v => v.name.toLowerCase() === query.trim().toLowerCase());
    const target = exact ? exact.name : (matches[0] ? matches[0].name : query);
    handleSignOut(target);
  }

  function handleKey(e) {
    if (!focused || matches.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter' && matches[cursor]) {
      e.preventDefault();
      setQuery(matches[cursor].name);
      setFocused(false);
      handleSignOut(matches[cursor].name);
    }
  }

  return (
    <div className="card">
      <div className="eyebrow">Signing out</div>
      <h1 className="display">Safe <em>travels</em>.</h1>
      <p className="lede">
        {loading
          ? 'Looking up today\'s visitors…'
          : active.length === 0
            ? 'There are no active visitors to sign out right now.'
            : 'Start typing your name — we\'ll find you.'}
      </p>

      {error && <div className="banner">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field" ref={wrapRef}>
          <label htmlFor="sname">Your name</label>
          <input
            id="sname"
            value={query}
            onChange={e => { setQuery(e.target.value); setCursor(0); setFocused(true); }}
            onFocus={() => setFocused(true)}
            onKeyDown={handleKey}
            placeholder="Start typing…"
            autoComplete="off"
            required
            disabled={loading || submitting}
          />
          {focused && !loading && (
            <div className="suggest" role="listbox">
              {matches.length === 0 ? (
                <div className="empty">No match for "{query}"</div>
              ) : matches.map((v, i) => (
                <button
                  key={v.name + i}
                  type="button"
                  className={i === cursor ? 'active' : ''}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => {
                    setQuery(v.name);
                    setFocused(false);
                    handleSignOut(v.name);
                  }}
                >
                  <div>{v.name}</div>
                  <div className="meta">
                    Visiting {v.host} · arrived {v.arrival}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="row">
          <button type="button" className="ghost" onClick={onBack}>Back</button>
          <button type="submit" className="primary" disabled={submitting || !query.trim()}>
            {submitting ? 'Signing you out…' : 'Sign out'}
          </button>
        </div>
      </form>
    </div>
  );
}
