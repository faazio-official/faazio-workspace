import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

// Capture the scanner config so the test can drive a scan, and never touch a real camera.
let mockScanner: { onCodeScanned?: (codes: { value?: string }[]) => void } = {};
jest.mock('react-native-vision-camera', () => ({
  Camera: () => null,
  useCameraDevice: () => ({ id: 'back' }),
  useCameraPermission: () => ({ hasPermission: true, requestPermission: jest.fn() }),
  useCodeScanner: (opts: { onCodeScanned?: (codes: { value?: string }[]) => void }) => {
    mockScanner = opts;
    return opts;
  },
}));

import { PickupScanModal } from '../screens/PickupScanModal';

describe('PickupScanModal (Workflow 3 — seller QR scan)', () => {
  beforeEach(() => {
    mockScanner = {};
  });

  it('returns the scanned QR token exactly once', async () => {
    const onScanned = jest.fn();
    await render(<PickupScanModal visible onClose={jest.fn()} onScanned={onScanned} />);

    await act(async () => {
      mockScanner.onCodeScanned?.([{ value: 'stop-1.9999999999.sig' }]);
      // A second scan in the same session must be ignored (handled guard).
      mockScanner.onCodeScanned?.([{ value: 'stop-1.9999999999.sig' }]);
    });

    expect(onScanned).toHaveBeenCalledTimes(1);
    expect(onScanned).toHaveBeenCalledWith('stop-1.9999999999.sig');
  });

  it('closes via Cancel', async () => {
    const onClose = jest.fn();
    await render(<PickupScanModal visible onClose={onClose} onScanned={jest.fn()} />);
    await fireEvent.press(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});