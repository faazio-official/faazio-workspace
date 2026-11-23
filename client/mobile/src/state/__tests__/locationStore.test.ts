import { useLocationStore } from '../locationStore';

const KARAIL = { latitude: 10.9254, longitude: 79.838 };
const CHENNAI = { latitude: 13.0827, longitude: 80.2707 };

function reset() {
  useLocationStore.setState({
    status: 'idle',
    deviceFix: null,
    activeLocation: null,
    overrideActive: false,
    permissionGranted: false,
    servicesEnabled: true,
    hydrated: true,
    fixAttemptedAt: null,
  });
}

beforeEach(reset);

describe('locationStore — device fix vs active location', () => {
  it('records a device fix without choosing an origin', () => {
    useLocationStore.getState().setDeviceFix({ coordinates: KARAIL, address: 'Lalgudi' });
    const s = useLocationStore.getState();
    expect(s.deviceFix?.latitude).toBe(KARAIL.latitude);
    // A fix alone must not silently become the origin — the poller decides that.
    expect(s.activeLocation).toBeNull();
    expect(s.permissionGranted).toBe(true);
  });

  it('adopts the device fix as the origin', () => {
    useLocationStore.getState().setDeviceFix({ coordinates: KARAIL, address: 'Lalgudi' });
    useLocationStore.getState().adoptDeviceAsActive();
    const s = useLocationStore.getState();
    expect(s.activeLocation).toEqual(
      expect.objectContaining({ latitude: KARAIL.latitude, source: 'gps', address: 'Lalgudi' }),
    );
    expect(s.status).toBe('ready');
    expect(s.overrideActive).toBe(false);
  });

  it('auto-selects a nearby saved address while unoverridden', () => {
    useLocationStore.getState().setDeviceFix({ coordinates: KARAIL, address: 'Lalgudi' });
    useLocationStore.getState().syncActiveToDevice({
      addressId: 'addr_1',
      coordinates: KARAIL,
      address: 'Home, Karaikal',
    });
    const s = useLocationStore.getState();
    expect(s.activeLocation).toEqual(
      expect.objectContaining({ source: 'saved', addressId: 'addr_1', address: 'Home, Karaikal' }),
    );
  });

  it('falls back to the device fix when nothing is nearby', () => {
    useLocationStore.getState().setDeviceFix({ coordinates: KARAIL, address: 'Lalgudi' });
    useLocationStore.getState().syncActiveToDevice(null);
    expect(useLocationStore.getState().activeLocation).toEqual(
      expect.objectContaining({ source: 'gps', address: 'Lalgudi' }),
    );
  });

  it('never overrides an explicit choice — the device keeps moving separately', () => {
    // User deliberately picked a Chennai saved address.
    useLocationStore.getState().setActiveLocation({
      coordinates: CHENNAI,
      address: 'Chennai flat',
      source: 'saved',
      addressId: 'addr_chennai',
    });
    // Meanwhile the phone is still in Karaikal, and a fix lands.
    useLocationStore.getState().setDeviceFix({ coordinates: KARAIL, address: 'Lalgudi' });
    useLocationStore.getState().syncActiveToDevice({
      addressId: 'addr_1',
      coordinates: KARAIL,
      address: 'Home, Karaikal',
    });

    const s = useLocationStore.getState();
    // The origin the user chose must survive…
    expect(s.activeLocation).toEqual(
      expect.objectContaining({ latitude: CHENNAI.latitude, addressId: 'addr_chennai' }),
    );
    // …while the device truth is still available for the distance guardrail.
    expect(s.deviceFix?.latitude).toBe(KARAIL.latitude);
  });

  it('"use my location" clears the override and follows the device again', () => {
    useLocationStore.getState().setActiveLocation({
      coordinates: CHENNAI,
      address: 'Chennai flat',
      source: 'saved',
      addressId: 'addr_chennai',
    });
    useLocationStore.getState().setDeviceFix({ coordinates: KARAIL, address: 'Lalgudi' });
    useLocationStore.getState().adoptDeviceAsActive();

    const s = useLocationStore.getState();
    expect(s.overrideActive).toBe(false);
    expect(s.activeLocation).toEqual(
      expect.objectContaining({ latitude: KARAIL.latitude, source: 'gps' }),
    );
  });

  it('keeps a chosen origin usable when GPS is denied', () => {
    useLocationStore.getState().setActiveLocation({
      coordinates: CHENNAI,
      address: 'Chennai flat',
      source: 'saved',
      addressId: 'addr_chennai',
    });
    useLocationStore.getState().setPermissionStatus('denied', false);
    const s = useLocationStore.getState();
    expect(s.status).toBe('ready');
    expect(s.activeLocation?.address).toBe('Chennai flat');
  });

  it('marks only the first fix attempt of the session', () => {
    expect(useLocationStore.getState().fixAttemptedAt).toBeNull();
    useLocationStore.getState().markFixAttempt();
    const first = useLocationStore.getState().fixAttemptedAt;
    expect(first).not.toBeNull();
    useLocationStore.getState().markFixAttempt();
    // Later polls must not keep re-arming the coverage hold.
    expect(useLocationStore.getState().fixAttemptedAt).toBe(first);
  });

  it('a live fix that lands during hydration is not overwritten by the persisted origin', async () => {
    // Yesterday the app stored an out-of-coverage origin (Chennai).
    const AsyncStorage = jest.requireMock('@react-native-async-storage/async-storage');
    AsyncStorage.getItem.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve(
                JSON.stringify({
                  deviceFix: {
                    latitude: CHENNAI.latitude,
                    longitude: CHENNAI.longitude,
                    accuracy: null,
                    address: 'Chennai flat',
                    place: null,
                    updatedAt: 1,
                  },
                  activeLocation: {
                    latitude: CHENNAI.latitude,
                    longitude: CHENNAI.longitude,
                    address: 'Chennai flat',
                    source: 'gps',
                    updatedAt: 1,
                  },
                  overrideActive: false,
                  permissionGranted: true,
                  status: 'ready',
                }),
              ),
            5,
          ),
        ),
    );
    useLocationStore.setState({
      status: 'idle',
      deviceFix: null,
      activeLocation: null,
      overrideActive: false,
      permissionGranted: false,
      hydrated: false,
      fixAttemptedAt: null,
    });

    const hydration = useLocationStore.getState().hydrate();
    // The device reports the user is now in Karaikal before the storage read resolves.
    useLocationStore.getState().setDeviceFix({ coordinates: KARAIL, address: 'Lalgudi' });
    useLocationStore.getState().adoptDeviceAsActive();
    await hydration;

    const s = useLocationStore.getState();
    expect(s.activeLocation?.address).toBe('Lalgudi');
    expect(s.deviceFix?.latitude).toBe(KARAIL.latitude);
    expect(s.status).toBe('ready');
  });
});
