import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import ToastProvider from '@/components/ui/ToastProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Shomiti',
  description: 'Cooperative Management System',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({ children }) {
  return (
    <html lang="bn">
      <body className={`${inter.className} min-h-screen bg-brand-50`}>
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}