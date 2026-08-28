import { useState, type FormEvent } from 'react';
import { useUiLanguage } from './UiLanguage';
import { authorizeDevelopmentMode } from './DevelopmentModeAccess';

export function DevelopmentModeGate({
  active,
  canLock,
  defaultOpen = false,
  onUnlock,
  onLock,
}: {
  active: boolean;
  canLock: boolean;
  defaultOpen?: boolean;
  onUnlock: (sessionToken: string) => void;
  onLock: () => void;
}) {
  const { text } = useUiLanguage();
  const [open, setOpen] = useState(defaultOpen);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  if (active) {
    return <div className="development-mode-access active">
      <strong className="development-mode-badge">DEVELOPMENT MODE</strong>
      {canLock ? <button className="development-mode-exit" type="button" onClick={onLock}>
        {text('Exit', '終了')}
      </button> : null}
    </div>;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const credential = password.trim();
    setPassword('');
    setBusy(true);
    setStatus(text('Checking Pass...', 'Passを確認しています…'));
    try {
      const sessionToken = await authorizeDevelopmentMode(credential);
      setOpen(false);
      setStatus('');
      onUnlock(sessionToken);
    } catch {
      setStatus(text('Pass was rejected.', 'Passが違います。'));
    } finally {
      setBusy(false);
    }
  };

  return <div className="development-mode-access">
    <button className="development-mode-entry" type="button" onClick={() => {
      setOpen((current) => !current);
      setStatus('');
    }}>
      {text('Development Mode', 'Development Mode')}
    </button>
    {open ? <form className="development-mode-login" onSubmit={(event) => void submit(event)}>
      <label htmlFor="development-mode-pass">Pass</label>
      <input
        id="development-mode-pass"
        aria-label="Development Mode Pass"
        autoComplete="current-password"
        disabled={busy}
        type="password"
        value={password}
        onChange={(event) => setPassword(event.currentTarget.value)}
      />
      <button disabled={busy || !password.trim()} type="submit">{text('Enter', '入る')}</button>
      {status ? <span role="status">{status}</span> : null}
    </form> : null}
  </div>;
}
