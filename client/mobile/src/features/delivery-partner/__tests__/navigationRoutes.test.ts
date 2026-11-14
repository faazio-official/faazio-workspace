import { resetToTab } from '../navigationRoutes';

describe('resetToTab', () => {
  it('resets the stack to the Main tab shell on the requested tab', () => {
    const reset = jest.fn();
    resetToTab({ reset } as never, 'Dashboard');
    expect(reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Main', params: { screen: 'Dashboard' } }],
    });
  });
});
