import type { ReactNode } from 'react';

/** White A4-wide sheet with the company header, as on the legacy form page. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="container">
      <header className="header">
        <img className="header_img" src="header.jpg" alt="Гельстер" />
      </header>
      <main className="content">{children}</main>
      <div className="br" />
    </div>
  );
}
