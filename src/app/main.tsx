import React from 'react';
import ReactDOM from 'react-dom/client';
import { WebMugenApp } from './WebMugenApp';
import './style.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <WebMugenApp />
  </React.StrictMode>,
);
