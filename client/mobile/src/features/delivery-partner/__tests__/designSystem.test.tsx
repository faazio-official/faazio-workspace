import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { DPStatusPill, toneForStatus } from '@/components/shared/dp';
import { DELIVERY } from '@/theme/deliveryTokens';
import { DELIVERY_TABS } from '../components/DeliveryTabBar';

describe('delivery design system', () => {
  it('anchors the brand on the parent ramp, not the old orphan hex', () => {
    expect(DELIVERY.brand).toBe('#1627E9');
    expect(DELIVERY.brandTint).toBe('#E8F1FC');
  });

  it('maps rider statuses to semantic tones', () => {
    expect(toneForStatus('ACTIVE')).toBe('success');
    expect(toneForStatus('REJECTED')).toBe('danger');
    expect(toneForStatus('PENDING_REVIEW')).toBe('warning');
    expect(toneForStatus('UNKNOWN_STATUS')).toBe('neutral');
  });

  it('renders a status pill with a sentence-case label', async () => {
    await render(<DPStatusPill status="PENDING_REVIEW" />);
    expect(screen.getByText('Pending review')).toBeTruthy();
  });

  it('exposes the five reference-style bottom tabs', () => {
    expect(DELIVERY_TABS.map((t) => t.label)).toEqual(['Home', 'Earnings', 'Orders', 'Alerts', 'Profile']);
  });
});
