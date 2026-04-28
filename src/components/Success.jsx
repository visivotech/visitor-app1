import { useEffect } from 'react';

export default function Success({ kind, name, host, emailSent, onReset }) {
  // Auto-return to home after 6 seconds.
  useEffect(() => {
    const t = setTimeout(onReset, 6000);
    return () => clearTimeout(t);
  }, [onReset]);

  const isIn = kind === 'signin';

  return (
    <div className="card success-big">
      <div className="ring">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.2 4.2L19 7" />
        </svg>
      </div>

      <div className="eyebrow">{isIn ? "You're signed in" : "You're signed out"}</div>
      <h1 className="display">
        {isIn ? <>Thanks, {name || 'there'}</> : <>See you soon</>}
      </h1>
      <p className="lede">
        {isIn
          ? (emailSent
              ? <>We've let <strong>{host}</strong> know you've arrived. They'll be with you shortly.</>
              : <>You're all signed in. Someone from reception will be with you shortly.</>)
          : <>Have a lovely rest of your day.</>}
      </p>
      <button className="primary" onClick={onReset}>
        Back to start
      </button>
    </div>
  );
}
