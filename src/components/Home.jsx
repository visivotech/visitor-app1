export default function Home({ onPick }) {
  return (
    <div className="card">
      <div className="eyebrow">Reception</div>
      <h1 className="display">Welcome to Gen II</h1>
      <p className="lede">
        Please sign in so we can let your host know you've arrived. Don't forget
        to sign out again on your way out.
      </p>

      <div className="choices">
        <button className="choice" onClick={() => onPick('signin')}>
          <span className="big">Sign in</span>
          <span className="sub">I'm arriving for a visit</span>
          <span className="arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </span>
        </button>
        <button className="choice" onClick={() => onPick('signout')}>
          <span className="big">Sign out</span>
          <span className="sub">I'm leaving</span>
          <span className="arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
}
