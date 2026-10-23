import { FaazioLogo } from "@/components/faazio-logo";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-width">
        <div className="footer-top">
          <div className="footer-brand">
            <a href="/" className="wordmark" aria-label="Faazio home">
              <FaazioLogo className="wordmark-logo" />
            </a>
            <p>
              Your daily superapp.
              <br />
              Made for your neighbourhood.
            </p>
          </div>
          <div className="footer-links">
            <div>
              <h3>Your everyday</h3>
              <a href="/#mart">Faazio Mart</a>
              <a href="/#food">Faazio Food</a>
              <a href="/#pharma">Faazio Pharma</a>
            </div>
            <div>
              <h3>Faazio</h3>
              <a href="/about">About Faazio</a>
              <a href="/karaikal">Karaikal</a>
              <a href="/partners">Partner with us</a>
            </div>
            <div>
              <h3>A little help</h3>
              <a href="/faq">FAQs</a>
              <a href="/download">Get the app</a>
              <a href="/#how-it-works">How it works</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getUTCFullYear()} Faazio. Made for daily India.</span>
          <span>Starting in Karaikal · More neighbourhoods to come</span>
        </div>
      </div>
    </footer>
  );
}
