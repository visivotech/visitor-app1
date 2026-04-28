import { useEffect, useState } from 'react';
import { fetchHosts, signIn } from '../api';

export default function SignIn({ onDone, onBack }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [host, setHost] = useState('');
  const [hosts, setHosts] = useState([]);
  const [loadingHosts, setLoadingHosts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchHosts()
      .then(d => setHosts(d.hosts || []))
      .catch(err => setError('Could not load host list. ' + err.message))
      .finally(() => setLoadingHosts(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !reason.trim() || !host) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await signIn({
        name: name.trim(),
        phone: phone.trim(),
        reason: reason.trim(),
        host,
        vehicle: vehicle.trim().toUpperCase(),
      });
      onDone({ name: name.trim(), host, emailSent: res.emailSent });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <div className="eyebrow">Sign in</div>
      <h1 className="display">Tell us about your visit</h1>
      <p className="lede">A few quick details and we'll let your host know you're here.</p>

      {error && <div className="banner">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input
            id="name"
            autoComplete="name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Alex Morgan"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="phone">Mobile number</label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="07123 456 789"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="reason">Reason for visit</label>
          <input
            id="reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. 10am meeting, delivery, interview"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="vehicle">
            Vehicle registration <span className="hint">— if driving</span>
          </label>
          <input
            id="vehicle"
            className="uppercase"
            value={vehicle}
            onChange={e => setVehicle(e.target.value)}
            placeholder="AB12 CDE"
            maxLength={10}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck="false"
          />
        </div>

        <div className="field">
          <label htmlFor="host">Who are you here to see?</label>
          <select
            id="host"
            value={host}
            onChange={e => setHost(e.target.value)}
            disabled={loadingHosts}
            required
          >
            <option value="" disabled>
              {loadingHosts ? 'Loading hosts…' : 'Select a host'}
            </option>
            {hosts.map(h => (
              <option key={h.name} value={h.name}>{h.name}</option>
            ))}
          </select>
        </div>

        <div className="row">
          <button type="button" className="ghost" onClick={onBack}>Back</button>
          <button type="submit" className="primary" disabled={submitting || loadingHosts}>
            {submitting ? 'Signing you in…' : 'Sign in'}
          </button>
        </div>
      </form>
    </div>
  );
}
