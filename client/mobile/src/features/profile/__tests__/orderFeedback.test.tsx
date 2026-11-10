import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('@/state/ordersStore', () => {
  const getOrderById = jest.fn();
  return { useOrdersStore: { getState: () => ({ getOrderById }) } };
});

jest.mock('@/services/api/GatewayClient', () => ({
  gateway: {
    remoteEnabled: true,
    getOrderFeedback: jest.fn(),
    submitOrderFeedback: jest.fn(),
  },
}));

import { useOrdersStore } from '@/state/ordersStore';
import { gateway } from '@/services/api/GatewayClient';
import { OrderFeedbackScreen } from '../OrderFeedbackScreen';

const setOrder = (order: unknown) =>
  (useOrdersStore.getState().getOrderById as jest.Mock).mockReturnValue(order);

const renderScreen = (navigation: { goBack: jest.Mock }) =>
  render(
    <OrderFeedbackScreen
      navigation={navigation as never}
      route={{ params: { orderId: 'ORD-1' } } as never}
    />,
  );

describe('OrderFeedbackScreen (Workflow 7 — order feedback)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setOrder({ id: 'ORD-1', status: 'Delivered', vendorName: 'Faazio Mart' });
    (gateway.getOrderFeedback as jest.Mock).mockResolvedValue({ orderId: 'ORD-1', rating: 0, comment: '' });
  });

  it('submits 1-5 stars and confirms', async () => {
    (gateway.submitOrderFeedback as jest.Mock).mockResolvedValue('synced');
    const goBack = jest.fn();
    await renderScreen({ goBack });

    await fireEvent.press(await screen.findByRole('button', { name: '5 stars' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Update feedback' }));

    await waitFor(() => expect(gateway.submitOrderFeedback).toHaveBeenCalledWith('ORD-1', 5, ''));
    expect(await screen.findByText('Feedback saved')).toBeTruthy();
  });

  it('blocks review for a non-delivered order and never calls the gateway write', async () => {
    setOrder({ id: 'ORD-1', status: 'Processing' });
    const goBack = jest.fn();
    await renderScreen({ goBack });

    expect(await screen.findByText('Delivered orders only')).toBeTruthy();
    expect(gateway.submitOrderFeedback).not.toHaveBeenCalled();
  });
});