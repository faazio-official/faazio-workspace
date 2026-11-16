import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../components/DeliveryHeader', () => ({ DeliveryHeader: () => null }));
jest.mock('@/services/api/GatewayClient', () => ({
  gateway: {
    getDeliveryPayouts: jest.fn(),
    getDeliveryPayoutsSummary: jest.fn(),
    getDeliveryPayoutSettings: jest.fn(),
  },
}));

import { gateway } from '@/services/api/GatewayClient';
import { PayoutScreen } from '../screens/PayoutScreen';

const row = {
  payoutId: 'dp-1',
  orderId: 'aaa111abc123',
  riderId: 'rider-1',
  distanceKm: 5,
  baseRatePaisa: 3000,
  extraKmChargePaisa: 1400,
  surgePaisa: 0,
  totalPaisa: 4400,
  status: 'PENDING',
  paidAmountPaisa: 0,
};
const second = { ...row, payoutId: 'dp-2', orderId: 'bbb222abc123', totalPaisa: 5000 };

describe('PayoutScreen (earnings ledger)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (gateway.getDeliveryPayouts as jest.Mock).mockResolvedValue([row, second]);
    (gateway.getDeliveryPayoutsSummary as jest.Mock).mockResolvedValue({
      pendingPaisa: 123400,
      paidPaisa: 56700,
    });
    (gateway.getDeliveryPayoutSettings as jest.Mock).mockResolvedValue({
      baseRatePaisa: 4000,
      baseDistanceKm: 4,
      perExtraKmPaisa: 900,
      nightSurgePaisa: 2000,
      weatherSurgePaisa: 2500,
      festivalSurgePaisa: 1500,
    });
  });

  it('uses server lifetime totals and the live rate card', async () => {
    await render(
      <PayoutScreen navigation={{ navigate: jest.fn() } as never} route={{} as never} />,
    );

    await waitFor(() => expect(screen.getByText('₹1,234')).toBeTruthy());
    expect(screen.getByText('₹567')).toBeTruthy();
    expect(screen.getByText(/₹40 base for the first 4 km/)).toBeTruthy();
  });

  it('disambiguates colliding order suffixes and opens the breakdown popup', async () => {
    const navigate = jest.fn();
    await render(<PayoutScreen navigation={{ navigate } as never} route={{} as never} />);

    await waitFor(() => expect(screen.getByText('Order 1abc123')).toBeTruthy());
    expect(screen.getByText('Order 2abc123')).toBeTruthy();
    expect(screen.queryByText('Order abc123')).toBeNull();

    fireEvent.press(screen.getAllByText('View breakdown')[0]);
    await waitFor(() => expect(screen.getByText('Payout breakdown')).toBeTruthy());
    expect(screen.getByText('Base (first 4 km)')).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Done'));
    await waitFor(() => expect(screen.queryByText('Payout breakdown')).toBeNull());
  });
});