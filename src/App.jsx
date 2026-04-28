import { useState } from 'react';
import Home from './components/Home.jsx';
import SignIn from './components/SignIn.jsx';
import SignOut from './components/SignOut.jsx';
import Success from './components/Success.jsx';

export default function App() {
  const [screen, setScreen] = useState('home');
  const [result, setResult] = useState(null);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  function reset() {
    setScreen('home');
    setResult(null);
  }

  return (
    <div className="app">
      <div className="topbar">
        <span className="mark">Reception<em>.</em></span>
        <span>{today}</span>
      </div>

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
        Visitor registration · in case of emergency follow the nearest exit signs
      </footer>
    </div>
  );
}
