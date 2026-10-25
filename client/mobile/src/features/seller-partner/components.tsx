/**
 * Seller partner UI primitives. The partner shell already ships a lean, dependency-free set in
 * `delivery-partner/components`; re-export it so both partner products share one visual language
 * without duplicating styles.
 */
export {
  Card,
  DP as SP,
  ErrorText,
  Field,
  PrimaryButton,
  Screen,
  StatusPill,
} from '@/features/delivery-partner/components';
