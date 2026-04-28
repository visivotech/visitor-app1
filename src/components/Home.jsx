export default function Home({ onPick }) {
  return (
    <div className="card">
      <div className="eyebrow">Reception</div>
      <h1 className="display">
        <em>Welcome.</em><br />
        Please let us know<br />you're here.
      </h1>
      <p className="lede">
        Sign in so we can let your host know you've arrived. Don't forget to sign
        out again on your way out.
      </p>

      <div className="choices">
        <button className="choice" onClick={() => onPick('signin')}>
          <span className="big">I'm <em>arriving</em></span>
          <span className="sub">Sign in & notify your host</span>
        </button>
        <button className="choice" onClick={() => onPick('signout')}>
          <span className="big">I'm <em>leaving</em></span>
          <span className="sub">Sign out on your way out</span>
        </button>
      </div>
    </div>
  );
}
