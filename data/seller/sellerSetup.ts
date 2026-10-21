/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */

/** One required detail a partner must provide to open a seller account. */
export interface SellerSetupField {
  key: string;
  label: string;
  placeholder: string;
  hint?: string;
  /** Mock value shown to demonstrate the form (cleared before real entry). */
  sample?: string;
}

/** Ordered list of required seller-onboarding details (mock setup page). */
export const SELLER_SETUP_FIELDS: SellerSetupField[] = [
  { key: 'businessName', label: 'Business name', placeholder: 'e.g. Sharma Traders', sample: 'Sharma Traders' },
  { key: 'ownerName', label: 'Owner / contact name', placeholder: 'Full name', sample: 'Rohit Sharma' },
  { key: 'category', label: 'Category', placeholder: 'e.g. Grocery, Electronics', hint: 'What do you sell?', sample: 'Grocery' },
  { key: 'gstin', label: 'GSTIN', placeholder: '22ABCDE1234F1Z5', sample: '22ABCDE1234F1Z5' },
  { key: 'pan', label: 'PAN', placeholder: 'ABCDE1234F', sample: 'ABCDE1234F' },
  { key: 'businessAddress', label: 'Business address', placeholder: 'Full address', sample: '12, MG Road, Pune' },
  { key: 'state', label: 'State', placeholder: 'e.g. MH', hint: 'Detected from your location or entered manually', sample: 'MH' },
  { key: 'platformFee', label: 'Platform fee %', placeholder: '1 – 100', hint: 'Food sellers must set at least 5%', sample: '10' },
  { key: 'bankName', label: 'Bank name', placeholder: 'e.g. HDFC Bank', sample: 'HDFC Bank' },
  { key: 'bankAccount', label: 'Bank account number', placeholder: 'Account no.', sample: '•••• 4821' },
  { key: 'ifsc', label: 'IFSC code', placeholder: 'e.g. HDFC0001234', sample: 'HDFC0001234' },
  { key: 'bankBeneficiary', label: 'Beneficiary name', placeholder: 'As printed on the passbook', sample: 'Rohit Sharma' },
  { key: 'contactPhone', label: 'Contact phone', placeholder: '+91 00000 00000', sample: '+91 98765 43210' },
  { key: 'contactEmail', label: 'Contact email', placeholder: 'owner@business.com', sample: 'owner@business.com' },
  { key: 'fssaiNumber', label: 'FSSAI licence number', placeholder: '14-digit licence number', hint: 'Food sellers only', sample: '12345678901234' },
];
