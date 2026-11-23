import { findNearbySavedAddress, NEARBY_RADIUS_M } from '@/utils/addressProximity';
import type { SavedAddress } from '@data/types';

function addr(overrides: Partial<SavedAddress>): SavedAddress {
  return {
    id: 'a1',
    tag: 'HOME',
    name: 'A',
    phone: '0',
    address: 'Somewhere',
    ...overrides,
  };
}

// Karaikal town centre — the same default the pin pickers use.
const HERE = { latitude: 10.9254, longitude: 79.838 };

describe('findNearbySavedAddress', () => {
  it('returns null when no row is close enough', () => {
    const rows = [addr({ id: 'far', latitude: 12.8956, longitude: 77.6456 })];
    expect(findNearbySavedAddress(HERE, rows)).toBeNull();
  });

  it('matches a row inside the radius', () => {
    // ~50 m north of HERE.
    const rows = [addr({ id: 'near', latitude: 10.92585, longitude: 79.838 })];
    const hit = findNearbySavedAddress(HERE, rows);
    expect(hit?.addressId).toBe('near');
  });

  it('picks the closest of several matches', () => {
    const rows = [
      addr({ id: 'closer', latitude: 10.9255, longitude: 79.838 }),
      addr({ id: 'further', latitude: 10.9261, longitude: 79.838 }),
    ];
    expect(findNearbySavedAddress(HERE, rows)?.addressId).toBe('closer');
  });

  it('skips unpinned rows instead of guessing', () => {
    // A text-only row has no point; matching it would need a geocode per poll.
    const rows = [addr({ id: 'textonly' })];
    expect(findNearbySavedAddress(HERE, rows)).toBeNull();
  });

  it('respects the documented radius', () => {
    expect(NEARBY_RADIUS_M).toBe(200);
    // ~230 m away: outside the default radius, inside a widened one.
    const rows = [addr({ id: 'edge', latitude: 10.9275, longitude: 79.838 })];
    expect(findNearbySavedAddress(HERE, rows)).toBeNull();
    expect(findNearbySavedAddress(HERE, rows, 1000)?.addressId).toBe('edge');
  });

  it('treats the (0,0) sentinel as "no point"', () => {
    const rows = [addr({ id: 'zero', latitude: 0, longitude: 0 })];
    expect(findNearbySavedAddress(HERE, rows)).toBeNull();
  });
});
