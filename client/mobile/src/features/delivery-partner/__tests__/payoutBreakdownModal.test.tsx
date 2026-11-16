import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { RiderPayout } from '@/services/api/GatewayClient';
import { PayoutBreakdownModal } from '../screens/PayoutBreakdownModal';

const payout: RiderPayout = {
  payoutId: 'payout-1',
  orderId: 'abcdef123456',
  riderId: 'rider-1',
  distanceKm: 5.4,
  baseRatePaisa: 3000,
  extraKmChargePaisa: 1680,
  surgePaisa: 500,
  surgeReason: 'Rain',
  totalPaisa: 5180,
  status: 'PARTIAL',
  paidAmountPaisa: 2000,
  paidAt: '2026-11-15T10:00:00Z',
};

describe('PayoutBreakdownModal (payout in-page popup)', () => {
  it('renders the itemised breakdown for a payout', async () => {
    await render(<PayoutBreakdownModal visible payout={payout} onClose={jest.fn()} />);

    expect(screen.getByText('Payout breakdown')).toBeTruthy();
    expect(screen.getByText('Order 123456')).toBeTruthy();
    expect(screen.getByText('Distance')).toBeTruthy();
    expect(screen.getByText('5.4 km')).toBeTruthy();
    expect(screen.getByText('Base (first 3 km)')).toBeTruthy();
    expect(screen.getByText('Extra km')).toBeTruthy();
    expect(screen.getByText('Surge · Rain')).toBeTruthy();
    expect(screen.getByText('Total payout')).toBeTruthy();
    expect(screen.getByText('Paid so far')).toBeTruthy();
    expect(screen.getByText('Balance')).toBeTruthy();
    expect(screen.getByText('Paid on')).toBeTruthy();
  });

  it('closes via Done and via the X', async () => {
    const onClose = jest.fn();
    await render(<PayoutBreakdownModal visible payout={payout} onClose={onClose} />);

    await fireEvent.press(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByLabelText('Close payout breakdown'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('treats a PAID row as fully settled when paidAmountPaisa is absent', async () => {
    await render(
      <PayoutBreakdownModal
        visible
        payout={{ ...payout, status: 'PAID', paidAmountPaisa: undefined }}
        onClose={jest.fn()}
      />,
    );

    // Paid so far falls back to the total (₹51.80), not zero.
    expect(screen.getByText('₹51.80')).toBeTruthy();
    expect(screen.getByText('Balance')).toBeTruthy();
  });

  it('renders nothing for the body when no payout is selected', async () => {
    await render(<PayoutBreakdownModal visible={false} payout={null} onClose={jest.fn()} />);
    expect(screen.queryByText('Payout breakdown')).toBeNull();
  });
});