import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import AddToCartControl from '../AddToCartControl';
import ProductCardBase from '../ProductCardBase';
import { brandRamp, semantic } from '@/theme/brandTokens';
import type { Product } from '@data/types';

/** Simulates the real parent: Add creates the line, the stepper mutates its quantity. */
function ControlHarness({ initialQuantity = 0 }: { initialQuantity?: number }) {
  const [quantity, setQuantity] = useState(initialQuantity);
  return (
    <AddToCartControl
      quantity={quantity}
      onAdd={() => setQuantity((q) => q + 1)}
      onIncrement={() => setQuantity((q) => q + 1)}
      onDecrement={() => setQuantity((q) => Math.max(0, q - 1))}
      accent={brandRamp.MART.deep}
      onAccent={brandRamp.MART.onDeep}
      addedAccent={semantic.success}
      compact
      label="Coffee"
    />
  );
}

const PRODUCT: Product = {
  id: 'p-test-1',
  name: 'Coffee',
  price: 120,
  emoji: 'mart',
  image: '',
  desc: 'Fresh roast',
  rating: 4.5,
  app: 'MART',
  category: 'beverages',
};

function CardHarness() {
  const [quantity, setQuantity] = useState(0);
  return (
    <ProductCardBase
      product={PRODUCT}
      appBrand="MART"
      variant="grid2"
      quantity={quantity}
      onAdd={() => setQuantity((q) => q + 1)}
      onIncrement={() => setQuantity((q) => q + 1)}
      onDecrement={() => setQuantity((q) => Math.max(0, q - 1))}
    />
  );
}

describe('AddToCartControl', () => {
  it('starts as an Add pill and morphs into the stepper without leaving the card', async () => {
    await render(<ControlHarness />);

    expect(screen.getByText('Add')).toBeTruthy();
    expect(screen.getByLabelText('Add Coffee to cart')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Add Coffee to cart'));

    // The line now exists: the stepper is the live control and shows 1.
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByLabelText('Add one more Coffee')).toBeTruthy();
    expect(screen.getByLabelText('Remove one Coffee')).toBeTruthy();
  });

  it('increments and decrements in place, returning to Add at zero', async () => {
    await render(<ControlHarness />);

    await fireEvent.press(screen.getByLabelText('Add Coffee to cart'));
    await fireEvent.press(screen.getByLabelText('Add one more Coffee'));
    expect(screen.getByText('2')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Remove one Coffee'));
    expect(screen.getByText('1')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Remove one Coffee'));
    expect(screen.getByText('Add')).toBeTruthy();
  });

  it('exposes the stepper controls as labelled buttons for assistive tech', async () => {
    await render(<ControlHarness initialQuantity={2} />);

    expect(screen.getByLabelText('Remove one Coffee').props.accessibilityRole).toBe('button');
    expect(screen.getByLabelText('Add one more Coffee').props.accessibilityRole).toBe('button');
    expect(screen.getByText('2')).toBeTruthy();
  });
});

describe('ProductCardBase add flow', () => {
  it('replaces the card + control with the quantity stepper on press', async () => {
    await render(<CardHarness />);

    expect(screen.getByLabelText('Add Coffee to cart')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Add Coffee to cart'));

    expect(screen.getByText('1')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Add one more Coffee'));
    expect(screen.getByText('2')).toBeTruthy();
  });
});
