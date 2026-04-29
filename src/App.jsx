import { useState } from 'react';
import Home from './components/Home.jsx';
import SignIn from './components/SignIn.jsx';
import SignOut from './components/SignOut.jsx';
import Success from './components/Success.jsx';

const LOGO_URL = 'https://gen2fund.com/wp-content/themes/yoo_joline/cache/Gen-II-Logo_color-51c87588.png';

export default function App() {
  const [screen, setScreen] = useState('home');
  const [result, setResult] = useState(null);
  const [logoFailed, setLogoFailed] = useState(false);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  function reset() {
    setScreen('home');
    setResult(null);
  }

  return (
    <div className="app">
      <header className="topbar">
        {logoFailed ? (
          <span className="logo-fallback">Gen <span>II</span></span>
        ) : (
          <img
            src="/logo.png"
            alt="Gen II"
            className="logo"
            onError={(e) => {
              // Try the CDN fallback once. If that also fails, show text.
              if (e.currentTarget.src.endsWith('/logo.png')) {
                e.currentTarget.src = LOGO_URL;
              } else {
                setLogoFailed(true);
              }
            }}
          />
        )}
        <span className="meta">{today}</span>
      </header>

      <main className="stage">
        {screen === 'home' && (
          <Home onPick={(k) => setScreen(k)} />
        )}

        {screen === 'signin' && (
          <SignIn
            onDone={(r) => { setResult({ kind: 'signin', ...r }); setScreen('success'); }}
            onBack={reset}
          />
        )}

        {screen === 'signout' && (
          <SignOut
            onDone={(r) => { setResult({ kind: 'signout', ...r }); setScreen('success'); }}
            onBack={reset}
          />
        )}

        {screen === 'success' && result && (
          <Success {...result} onReset={reset} />
        )}
      </main>

      <footer className="footer">
        <a
          href="https://saluto.space"
          target="_blank"
          rel="noopener noreferrer"
          className="powered-by"
          aria-label="Powered by Saluto"
        >
          <span>Powered by</span>
          <img src="/saluto.png" alt="Saluto" />
        </a>
        <span className="footer-divider" aria-hidden="true">·</span>
        <span className="emergency">In case of emergency follow the nearest exit signs</span>
      </footer>
    </div>
  );
}
