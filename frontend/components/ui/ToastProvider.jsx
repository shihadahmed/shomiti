'use client';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function ToastProvider() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={3500}
      newestOnTop
      closeOnClick
      pauseOnFocusLoss
      pauseOnHover
      draggable
      theme="light"
      style={{ zIndex: 9999 }}
      toastOptions={{
        style: {
          background: '#ffffff',
          color: '#2D151B',
          border: '1px solid #E8D3A7',
          borderRadius: '14px',
          fontSize: '13px',
          boxShadow: '0 10px 25px -5px rgba(107, 29, 47, 0.1)',
        },
        success: { iconTheme: { primary: '#059669', secondary: '#fff' } },
        error: { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
      }}
    />
  );
}
