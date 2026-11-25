jest.mock('@/services/api/GatewayClient', () => ({ gateway: {} }));

import { matchServiceability } from '@/services/serviceability';

const coverage = {
  states: [
    { stateCode: 'TN', name: 'Tamil Nadu', kind: 'STATE' },
    { stateCode: 'PY', name: 'Puducherry', kind: 'UT' },
  ],
  districts: [
    {
      districtCode: 'TTC',
      name: 'Tiruchirappalli',
      stateCode: 'TN',
      latitude: 11.034599,
      longitude: 78.5660852,
    },
    {
      districtCode: 'TCH',
      name: 'Chennai',
      stateCode: 'TN',
      latitude: 13.0843007,
      longitude: 80.2704622,
    },
    {
      districtCode: 'PY0',
      name: 'Puducherry',
      stateCode: 'PY',
      latitude: 11.9415216,
      longitude: 79.8082102,
    },
  ],
};

describe('matchServiceability', () => {
  it('matches an enabled district from the formatted address', () => {
    const result = matchServiceability(
      'Lalgudi, Tiruchirappalli, Tamil Nadu 621601, India',
      null,
      coverage,
    );
    expect(result).toEqual({
      status: 'serviceable',
      match: {
        stateCode: 'TN',
        stateName: 'Tamil Nadu',
        districtCode: 'TTC',
        districtName: 'Tiruchirappalli',
      },
    });
  });

  it('prefers the reverse-geocoded district field', () => {
    const result = matchServiceability(
      'Some street, Tamil Nadu',
      { district: 'Chennai', region: 'Tamil Nadu' },
      coverage,
    );
    expect(result.status).toBe('serviceable');
    if (result.status === 'serviceable') {
      expect(result.match.districtCode).toBe('TCH');
    }
  });

  it('treats a district missing from the active list as unserviceable', () => {
    const result = matchServiceability(
      'Madurai, Tamil Nadu 625001, India',
      null,
      coverage,
    );
    expect(result).toEqual({
      status: 'unserviceable',
      reason: 'district_unavailable',
      stateName: 'Tamil Nadu',
    });
  });

  it('treats an inactive state as outside coverage', () => {
    const result = matchServiceability(
      'Bengaluru, Karnataka 560001, India',
      null,
      coverage,
    );
    expect(result).toEqual({ status: 'unserviceable', reason: 'outside_coverage' });
  });

  it('reports unknown when only a coordinate label exists', () => {
    expect(matchServiceability('10.7905, 78.7047', null, coverage)).toEqual({
      status: 'unknown',
      reason: 'no_address',
    });
  });

  it('normalises Pondicherry to Puducherry', () => {
    const result = matchServiceability(
      'Pondicherry, India',
      { region: 'Puducherry' },
      coverage,
    );
    expect(result.status).toBe('serviceable');
    if (result.status === 'serviceable') {
      expect(result.match.districtCode).toBe('PY0');
    }
  });

  // The platform geocoder's `district` field is the sub-locality, so a taluk town such as Lalgudi
  // reports "Lalgudi" — a name that exists in no district master. Coverage must come from the
  // revenue district (`adminDistrict`), or a fully covered user would be hard-blocked.
  it('matches a taluk town through the revenue district, not the sub-locality', () => {
    const result = matchServiceability(
      'Lalgudi, Tiruchirappalli, Tamil Nadu 621601, India',
      {
        district: 'Lalgudi',
        adminDistrict: 'Tiruchirappalli',
        region: 'Tamil Nadu',
      },
      coverage,
    );
    expect(result.status).toBe('serviceable');
    if (result.status === 'serviceable') {
      expect(result.match.districtCode).toBe('TTC');
    }
  });

  it('prefers the revenue district over a same-named sub-locality', () => {
    // A sub-locality literally called "Chennai" inside Tiruchirappalli district must not steal the
    // match: the revenue district is the coverage unit.
    const result = matchServiceability(
      'Chennai, Tiruchirappalli, Tamil Nadu, India',
      {
        district: 'Chennai',
        adminDistrict: 'Tiruchirappalli',
        region: 'Tamil Nadu',
      },
      coverage,
    );
    expect(result.status).toBe('serviceable');
    if (result.status === 'serviceable') {
      expect(result.match.districtCode).toBe('TTC');
    }
  });

  // Transliteration drift is common in the platform geocoder (`Tiruchirapalli` for the master's
  // `Tiruchirappalli`). A repeated-letter difference must not hard-block an enabled district.
  it('matches a district across a repeated-letter spelling difference', () => {
    const result = matchServiceability(
      'Lalgudi, Tiruchirapalli, Tamil Nadu 621601, India',
      {
        adminDistrict: 'Tiruchirapalli',
        city: 'Tiruchirapalli',
        region: 'Tamil Nadu',
      },
      coverage,
    );
    expect(result.status).toBe('serviceable');
    if (result.status === 'serviceable') {
      expect(result.match.districtCode).toBe('TTC');
    }
  });

  it('blocks a taluk town whose revenue district is not enabled', () => {
    const result = matchServiceability(
      'Melur, Madurai, Tamil Nadu 625106, India',
      {
        district: 'Melur',
        adminDistrict: 'Madurai',
        region: 'Tamil Nadu',
      },
      coverage,
    );
    expect(result).toEqual({
      status: 'unserviceable',
      reason: 'district_unavailable',
      stateName: 'Tamil Nadu',
    });
  });

  // Real device payload from Lalgudi (Tiruchirappalli district): the Android geocoder returned
  // `adminDistrict: null`, city "Lalgudi" and sub-locality "sirudayur", so neither the district field
  // nor the formatted address names Tiruchirappalli. The origin coordinates resolve the nearest
  // active district instead of hard-blocking a covered user.
  it('resolves a geocode with no district name from the origin centroid', () => {
    const result = matchServiceability(
      'sirudayur, Lalgudi, Tamil Nadu, 621601',
      {
        postalCode: '621601',
        city: 'Lalgudi',
        name: 'VRJ8+W46',
        district: 'sirudayur',
        region: 'Tamil Nadu',
        adminDistrict: null,
        street: null,
      },
      coverage,
      { latitude: 10.8821515, longitude: 78.8151983 },
    );
    expect(result).toEqual({
      status: 'serviceable',
      match: {
        stateCode: 'TN',
        stateName: 'Tamil Nadu',
        districtCode: 'TTC',
        districtName: 'Tiruchirappalli',
      },
    });
  });

  it('does not fall back to a centroid when the origin is far from every active district', () => {
    const result = matchServiceability(
      'Somewhere, Tamil Nadu',
      { region: 'Tamil Nadu' },
      coverage,
      { latitude: 28.6139, longitude: 77.209 },
    );
    expect(result).toEqual({
      status: 'unserviceable',
      reason: 'district_unavailable',
      stateName: 'Tamil Nadu',
    });
  });

  it('still blocks an omitted district name without origin coordinates', () => {
    const result = matchServiceability(
      'sirudayur, Lalgudi, Tamil Nadu, 621601',
      { city: 'Lalgudi', district: 'sirudayur', region: 'Tamil Nadu', adminDistrict: null },
      coverage,
    );
    expect(result).toEqual({
      status: 'unserviceable',
      reason: 'district_unavailable',
      stateName: 'Tamil Nadu',
    });
  });
});
