import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import CookieNotice from './CookieNotice';
import './styles.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /><CookieNotice/></React.StrictMode>);
