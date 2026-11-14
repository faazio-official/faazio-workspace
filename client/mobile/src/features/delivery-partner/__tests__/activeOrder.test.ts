import type { DeliveryOrder } from '@/services/api/GatewayClient';
import { activeOrderFrom } from '../activeOrder';

const order = (over: Partial<DeliveryOrder>): DeliveryOrder => over as unknown as DeliveryOrder;

describe('activeOrderFrom', () => {
  it('returns null when no job is accepted', () => {
    expect(activeOrderFrom([])).toBeNull();
    expect(activeOrderFrom([order({ status: 'ASSIGNED' })])).toBeNull();
  });

  it('labels an accepted job by its next pickup stop', () => {
    const accepted = order({
      orderId: 'o1',
      status: 'ACCEPTED',
      stops: [
        { stopType: 'PICKUP', status: 'PENDING', label: 'Store', address: '1 Store St' },
        { stopType: 'DROP', status: 'PENDING', label: 'Cust', address: '2 Drop Rd' },
      ] as never,
    });
    expect(activeOrderFrom([accepted])).toEqual({ orderId: 'o1', label: 'Pick up from Store' });
  });

  it('advances to the drop once the pickup is done', () => {
    const accepted = order({
      orderId: 'o2',
      status: 'ACCEPTED',
      stops: [
        { stopType: 'PICKUP', status: 'PICKED_UP', label: 'Store', address: '1 Store St' },
        { stopType: 'DROP', status: 'PENDING', label: 'Cust', address: '2 Drop Rd' },
      ] as never,
    });
    expect(activeOrderFrom([accepted])).toEqual({ orderId: 'o2', label: 'Deliver to Cust' });
  });

  it('falls back to generic copy when every stop is closed', () => {
    const accepted = order({
      orderId: 'o3',
      status: 'ACCEPTED',
      stops: [
        { stopType: 'PICKUP', status: 'PICKED_UP', label: 'Store', address: '1 Store St' },
        { stopType: 'DROP', status: 'DELIVERED', label: 'Cust', address: '2 Drop Rd' },
      ] as never,
    });
    expect(activeOrderFrom([accepted])).toEqual({ orderId: 'o3', label: 'Active delivery' });
  });
});