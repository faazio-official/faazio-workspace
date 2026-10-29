import { useState } from "react";
import {
  HiArrowDownTray,
  HiArrowUpRight,
  HiBars3 as Menu,
  HiMapPin as MapPin,
  HiXMark as X,
} from "react-icons/hi2";
import { FaazioLogo } from "@/components/faazio-logo";
import { Button } from "@/components/ui/button";

const navLinks = [
  { label: "About", href: "/about" },
  { label: "FAQ", href: "/faq" },
  { label: "Partners", href: "/partners" },
  { label: "Karaikal", href: "/karaikal" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms & Conditions", href: "/terms" },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-4"
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
          <span className="nav-location">
            <MapPin size={13} /> Starting in Karaikal
          </span>
          <a
            href="/download"
            className="download-button download-button-compact inline-flex items-center justify-center bg-cta text-cta-foreground hover:bg-cta-hover"
          >
            <span className="download-button-icon">
              <HiArrowDownTray aria-hidden="true" />
            </span>
            <span>Get the app</span>
            <HiArrowUpRight aria-hidden="true" className="download-button-arrow" />
          </a>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </nav>
      {menuOpen && (
        <nav
          id="mobile-navigation"
          aria-label="Mobile navigation"
          className="mobile-menu md:hidden"
        >
          <a href="/about" onClick={() => setMenuOpen(false)}>
            About
          </a>
          <a href="/faq" onClick={() => setMenuOpen(false)}>
            FAQ
          </a>
          <a href="/partners" onClick={() => setMenuOpen(false)}>
            Partners
          </a>
          <a href="/karaikal" onClick={() => setMenuOpen(false)}>
            Karaikal
          </a>
          <a href="/privacy" onClick={() => setMenuOpen(false)}>
            Privacy Policy
          </a>
          <a href="/terms" onClick={() => setMenuOpen(false)}>
            Terms &amp; Conditions
          </a>
          <a href="/download" onClick={() => setMenuOpen(false)}>
            Get the app
          </a>
        </nav>
      )}
    </header>
  );
}
