import { useState } from "react";
import { HiArrowDownTray, HiBars3 as Menu, HiXMark as X } from "react-icons/hi2";
import { FaazioLogo } from "@/components/faazio-logo";
import { ThemeToggle } from "@/components/theme-toggle";

const navLinks = [
  { label: "About", href: "/about" },
  { label: "FAQ", href: "/faq" },
  { label: "Partners", href: "/partners" },
  { label: "Karaikal", href: "/karaikal" },
];

/** Legal links live in the footer; the header carries only what a first-time
 *  visitor needs to decide. */
export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="site-header">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground"
      >
        Skip to content
      </a>
      <nav aria-label="Main navigation" className="page-width site-nav">
        <a href="/" aria-label="Faazio home" className="wordmark">
          <FaazioLogo className="wordmark-logo" />
        </a>
        <div className="nav-links">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </div>
        <div className="nav-actions">
          <ThemeToggle />
          <a href="/download" className="download-button">
            <span className="download-button-icon">
              <HiArrowDownTray aria-hidden="true" />
            </span>
            <span>Get the app</span>
          </a>
          <button
            type="button"
            className="btn btn-outline btn-sm nav-menu-btn"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>
      {menuOpen && (
        <nav id="mobile-navigation" aria-label="Mobile navigation" className="mobile-menu">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
              {link.label}
            </a>
          ))}
          <a href="/download" onClick={() => setMenuOpen(false)}>
            Get the app
          </a>
          <div className="mobile-menu-theme">
            <span>Theme</span>
            <ThemeToggle />
          </div>
        </nav>
      )}
    </header>
  );
}
