jest.mock('@/services/api/GatewayClient', () => ({ gateway: {} }));

import { matchServiceability } from '@/services/serviceability';

const coverage = {
  states: [
    { stateCode: 'TN', name: 'Tamil Nadu', kind: 'STATE' },
    { stateCode: 'PY', name: 'Puducherry', kind: 'UT' },
  ],
  districts: [
    { districtCode: 'TTC', name: 'Tiruchirappalli', stateCode: 'TN' },
    { districtCode: 'TCH', name: 'Chennai', stateCode: 'TN' },
    { districtCode: 'PY0', name: 'Puducherry', stateCode: 'PY' },
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
});
