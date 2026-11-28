/**
 * Hero-band tokens — the one artwork-led surface in the customer app.
 *
 * "My Account" opens on a burgundy/gold banner (`account_hero_background.webp`)
 * instead of the light canvas, so its text, borders and CTA need a second,
 * fixed colour set: they sit on artwork, not on `palette`. Every value below is
 * measured against the flat backdrop (`canvas`) and is documented in
 * `docs/UI_DESIGN_SYSTEM.md` §5 ("Account hero band"). Do not restate these
 * hexes elsewhere — import this module.
 */
export const hero = {
  /** Deepest burgundy, matches the backdrop's flat base (also the image fallback). */
  canvas: '#3B0109',
  /** Gold lift in the backdrop dome. */
  dome: '#5C0F1B',
  /** Frame, ticket and CTA fill. */
  gold: '#F6C453',
  /** Hairline borders, dividers and inactive flames. */
  goldMuted: 'rgba(246, 196, 83, 0.35)',
  /** Translucent gold wash for the Edit pill and avatar disc. */
  goldWash: 'rgba(246, 196, 83, 0.12)',
  /** Primary copy on the backdrop. 17.6:1 on `canvas`. */
  onHero: '#FFFFFF',
  /** Secondary copy on the backdrop. 11.7:1 on `canvas`. */
  onHeroMuted: '#F1CBB9',
  /** Card wash so text keeps its contrast over the artwork. */
  cardWash: 'rgba(46, 2, 8, 0.55)',
  /** Ink on a gold fill (10.1:1 on `gold`). */
  ink: '#3B0109',
} as const;
