import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import type { DeliveryOrder } from '@/services/api/GatewayClient';

jest.mock('@/services/api/GatewayClient', () => ({
  gateway: {
    getDeliveryRoute: jest.fn(),
    getActiveDeliveryOrders: jest.fn(),
    acceptDeliveryOrder: jest.fn(),
    rejectDeliveryOrder: jest.fn(),
  },
}));

import { gateway } from '@/services/api/GatewayClient';
import { AcceptRejectScreen } from '../screens/AcceptRejectScreen';

const assignedOrder = {
  orderId: 'dlv-1',
  customerOrderId: 'co-1',
  storeId: 'store-1',
  riderId: 'rider-1',
  status: 'ASSIGNED',
  routeSequence: [],
  totalDistanceMeters: 2000,
  estimatedDurationSeconds: 600,
  payoutAmountPaisa: 5000,
  payoutMode: 'AUTOMATED',
  requireOtp: false,
  assignedAt: '',
  createdAt: '',
  paymentMethod: 'COD',
  paymentStatus: 'PAID',
  paymentRequired: true,
  paymentReceived: false,
  stops: [
    { stopId: 's-p', deliveryOrderId: 'dlv-1', sequence: 1, stopType: 'PICKUP', status: 'PENDING', label: 'Store', address: '1 Store St' },
    { stopId: 's-d', deliveryOrderId: 'dlv-1', sequence: 2, stopType: 'DROP', status: 'PENDING', label: 'Cust', address: '2 Drop Rd' },
  ],
} as unknown as DeliveryOrder;

const mockNav = () => ({ replace: jest.fn(), navigate: jest.fn(), reset: jest.fn(), goBack: jest.fn() });

describe('AcceptRejectScreen (Workflow 2 — rider offer)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (gateway.getActiveDeliveryOrders as jest.Mock).mockResolvedValue([]);
  });

  it('accepts an offer through the gateway and navigates to the route', async () => {
    (gateway.getDeliveryRoute as jest.Mock).mockResolvedValue(assignedOrder);
    (gateway.acceptDeliveryOrder as jest.Mock).mockResolvedValue(assignedOrder);
    const navigation = mockNav();

    await render(
      <AcceptRejectScreen
        navigation={navigation as never}
        route={{ params: { orderId: 'dlv-1' } } as never}
      />,
    );

    await fireEvent.press(await screen.findByRole('button', { name: 'Accept offer' }));
    await waitFor(() => expect(gateway.acceptDeliveryOrder).toHaveBeenCalledWith('dlv-1'));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('Route'));
  });

  it('rejects an offer and returns to the dashboard', async () => {
    (gateway.getDeliveryRoute as jest.Mock).mockResolvedValue(assignedOrder);
    (gateway.rejectDeliveryOrder as jest.Mock).mockResolvedValue({ reassigned: false });
    const navigation = mockNav();

    await render(
      <AcceptRejectScreen
        navigation={navigation as never}
        route={{ params: { orderId: 'dlv-1' } } as never}
      />,
    );

    await fireEvent.press(await screen.findByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(gateway.rejectDeliveryOrder).toHaveBeenCalledWith('dlv-1'));
    // Dashboard is now a tab inside `Main`; reject lands on the Feed tab with no back entry.
    await waitFor(() =>
      expect(navigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Main', params: { screen: 'Dashboard' } }],
      }),
    );
  });
});
