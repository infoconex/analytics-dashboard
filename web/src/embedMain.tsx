import React from 'react';
import ReactDOM from 'react-dom/client';
import { EmbeddedDashboard } from './EmbeddedDashboard';
import './styles.css';
import './embed.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><EmbeddedDashboard /></React.StrictMode>,
);
