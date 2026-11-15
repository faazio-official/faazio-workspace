import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { DPEmptyState } from '../DPStates';
import { DPKpiCard } from '../DPKpi';
import { DPFadeOut } from '../DPMotion';
import { DPRouteRail } from '../DPRouteRail';
import { DPTabStrip } from '../DPTabStrip';

describe('dp primitives', () => {
  it('DRouteRail exposes the stop order to assistive tech', async () => {
    await render(<DPRouteRail stops={[{ label: 'Store' }, { label: 'Customer' }]} activeIndex={0} />);
    expect(screen.getByLabelText('Route: Store to Customer')).toBeTruthy();
  });

  it('DPTabStrip reports the active tab and its count, and fires onChange', async () => {
    const onChange = jest.fn();
    await render(
      <DPTabStrip
        active="all"
        onChange={onChange}
        tabs={[
          { key: 'all', label: 'All', count: 3 },
          { key: 'paid', label: 'Paid', count: 2 },
        ]}
      />,
    );
    expect(screen.getByLabelText('All, 3')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Paid, 2'));
    expect(onChange).toHaveBeenCalledWith('paid');
  });

  it('DPKpiCard is inert without a press handler and a labelled button with one', async () => {
    const { rerender } = await render(<DPKpiCard label="Pending" value="₹0" />);
    expect(screen.queryByRole('button')).toBeNull();

    const onPress = jest.fn();
    await rerender(<DPKpiCard label="Pending" value="₹0" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Pending: ₹0' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('DPEmptyState renders a compact variant with its copy', async () => {
    await render(<DPEmptyState compact title="No active deliveries" description="Nothing here yet." />);
    expect(screen.getByText('No active deliveries')).toBeTruthy();
    expect(screen.getByText('Nothing here yet.')).toBeTruthy();
  });

  it('DPFadeOut renders its children while visible', async () => {
    await render(
      <DPFadeOut visible onExited={jest.fn()}>
        <Text>Leaving card</Text>
      </DPFadeOut>,
    );
    expect(screen.getByText('Leaving card')).toBeTruthy();
  });
});