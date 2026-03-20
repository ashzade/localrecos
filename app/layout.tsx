import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LocalRecos — Community Restaurant Recommendations',
  description:
    'Find the best restaurants in your city based on real community recommendations from Reddit and local food communities.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <header className="border-b border-gray-200 bg-white">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="text-xl font-bold text-gray-900 tracking-tight">
              LocalRecos
            </a>
            <span className="text-sm text-gray-500">Community restaurant picks</span>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
