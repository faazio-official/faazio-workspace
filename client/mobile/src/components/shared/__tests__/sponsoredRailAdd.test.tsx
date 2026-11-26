import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import SponsoredRail from '../SponsoredRail';

jest.mock('@/services/api/GatewayClient', () => ({
  gateway: {
    getSponsoredProducts: jest.fn().mockResolvedValue([
      {
        id: 'ad-1',
        name: 'Coffee',
        price: 120,
        emoji: 'mart',
        slotId: 'slot-1',
        app: 'MART',
        category: 'beverages',
        image: '',
        desc: '',
        rating: 4.4,
      },
      {
        id: 'ad-2',
        name: 'Tea',
        price: 80,
        emoji: 'mart',
        slotId: 'slot-2',
        app: 'MART',
        category: 'beverages',
        image: '',
        desc: '',
        rating: 4.2,
      },
    ]),
    recordAdEvent: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('@/services/pricing', () => ({
  useActiveDiscounts: () => ({}),
  applyActiveDiscounts: (rows: unknown[]) => rows,
}));

// FlashList's native list is not needed for the handler-wiring simulation.
jest.mock('@shopify/flash-list', () => {
  const { FlatList } = require('react-native');
  return { FlashList: FlatList };
});

/** Simulates the Mart host: the rail owns quantities and the parent feeds them back in. */
function RailHarness() {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const bump = (id: string, delta: number) =>
    setQuantities((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + delta) }));

  return (
    <SponsoredRail
      placement="SPONSORED_SHOWCASE"
      addToCart={(id) => bump(id, 1)}
      quantityOf={(id) => quantities[id] ?? 0}
      onIncrement={(id) => bump(id, 1)}
      onDecrement={(id) => bump(id, -1)}
      renderCard={(product, handlers) => (
        <View key={product.id}>
          <Text>{product.name}</Text>
          <Text testID={`qty-${product.id}`}>{handlers.quantity}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`add-${product.id}`}
            onPress={handlers.onAdd}
          >
            <Text>Add</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`inc-${product.id}`}
            onPress={handlers.onIncrement}
          >
            <Text>+</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

describe('SponsoredRail add wiring', () => {
  it('renders a horizontal paid shelf and feeds live cart quantities into its cards', async () => {
    await render(<RailHarness />);

    expect(await screen.findByText('Coffee')).toBeTruthy();
    expect(await screen.findByText('Tea')).toBeTruthy();

    expect(screen.getByTestId('qty-ad-1').props.children).toBe(0);
    await fireEvent.press(screen.getByLabelText('add-ad-1'));
    expect(screen.getByTestId('qty-ad-1').props.children).toBe(1);

    await fireEvent.press(screen.getByLabelText('inc-ad-1'));
    expect(screen.getByTestId('qty-ad-1').props.children).toBe(2);

    // A different slot keeps its own quantity.
    expect(screen.getByTestId('qty-ad-2').props.children).toBe(0);
  });
});
