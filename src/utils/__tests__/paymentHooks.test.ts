import { usePaymentGateway } from '../paymentHooks';
import { Alert } from 'react-native';

describe('usePaymentGateway (Native Hook)', () => {
  const originalEnv = process.env;
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('initializes payment gateway hook with provider razorpay', () => {
    const hook = usePaymentGateway('IN');
    expect(hook.provider).toBe('razorpay');
    expect(typeof hook.initPaymentSheet).toBe('function');
    expect(typeof hook.presentPaymentSheet).toBe('function');
  });

  test('returns alert when RazorpayCheckout module is not installed', async () => {
    const hook = usePaymentGateway('IN');
    const result = await hook.presentPaymentSheet({ amount: 1000 });
    
    expect(alertSpy).toHaveBeenCalledWith(
      'Development Build Required',
      'Razorpay native module is not available in Expo Go. Please test on Web or in a Development Build.'
    );
    expect(result).toEqual({
      error: { code: 'Unavailable', message: 'Module not found' },
    });
  });

  test('initPaymentSheet resolves cleanly', async () => {
    const hook = usePaymentGateway('IN');
    const res = await hook.initPaymentSheet();
    expect(res).toEqual({ error: null });
  });
});
