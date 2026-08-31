export type UserRole = 'Customer' | 'Vendor' | 'Operator' | 'Admin';

export interface Profile {
  id: string;
  email: string;
  name: string;
  phone_number: string;
  profile_image: string;
  role: UserRole;
  student_staff_id: string;
  created_at: string;
}

export interface Vendor {
  id: string;
  name: string;
  image: string;
  status: 'Open' | 'Closed' | 'Suspended';
  orders_paused: boolean;
  owner_id: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  target_audience: 'Customer' | 'Vendor' | 'Operator' | 'All';
  created_by: string | null;
  created_at: string;
}

// ── Admin types ──────────────────────────────────────────────────────────────

export interface AdminKPIs {
  activeOrders: number;
  grossVolume: number;
  activeCustomers: number;
  registeredVendors: number;
  activeRiders: number;
}

export interface AdminOrderRow {
  id: string;
  order_ref: string;
  customer_name: string;
  vendor_name: string;
  status: string;
  total_price: number;
  created_at: string;
  runner_id: string | null;
  runner_name: string | null;
}

export interface AdminCustomerRow {
  id: string;
  name: string;
  email: string;
  phone_number: string;
  customer_balance: number;
  active_passes: number;
  total_orders: number;
  created_at: string;
}

export interface AdminTransactionRow {
  id: string;
  amount: number;
  transaction_type: string;
  reference_id: string;
  description: string;
  created_at: string;
  wallet_user_name: string;
}

export interface PeakHourData { hour: number; count: number; }
export interface TopDishData { item_name: string; vendor_name: string; total_orders: number; total_revenue: number; }
export interface HotspotData { location_name: string; order_count: number; }

export interface MenuSection {
  id: string;
  vendor_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface MenuItem {
  id: string;
  vendor_id: string;
  section_id: string | null;
  item_name: string;
  description: string;
  price: number;
  image: string;
  is_active: boolean;
  prep_time_mins: number | null;
  created_at: string;
}

export interface CampusDropoffLocation {
  id: string;
  location_name: string;
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  customer_balance: number;
  vendor_balance: number;
  platform_owner_balance: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  wallet_id: string;
  amount: number;
  transaction_type: 'Debit' | 'Credit';
  reference_id: string;
  description: string;
  created_at: string;
}

export interface Order {
  id: string;
  order_ref: string;
  delivery_code: string | null;
  customer_id: string;
  vendor_id: string;
  runner_id: string | null;
  dropoff_location_id: string | null;
  location_description: string;
  delivery_notes: string;
  subtotal: number;
  delivery_fee: number;
  packaging_fee: number;
  total_price: number;
  status: 'Pending' | 'Preparing' | 'Out for Delivery' | 'Arrived at Dropoff' | 'Completed' | 'Cancelled';
  payment_status: string;
  paystack_reference: string | null;
  created_at: string;
  completed_at: string | null;
  scheduled_for: string | null; // null = ASAP; otherwise customer-requested delivery time (ISO string)
  plate_packaging: Record<string, boolean>; // which plate labels within this order had packaging requested, e.g. { "Plate A": true, "Plate B": false }
  // Joined fields
  customer?: Pick<Profile, 'id' | 'name' | 'email'>;
  vendor?: Pick<Vendor, 'id' | 'name'>;
  runner?: Pick<Profile, 'id' | 'name'> | null;
  dropoff_location?: Pick<CampusDropoffLocation, 'id' | 'location_name'> | null;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_id: string;
  item_name: string;
  price: number;
  quantity: number;
  plate_label: string; // which plate within the order this line belongs to, e.g. "Plate A" — lets a single vendor order contain multiple distinct plates, each with its own set of items
  created_at: string;
}

export interface SupportRequest {
  id: string;
  subject: string;
  message: string;
  submitted_by: string;
  created_at: string;
}

// ── Cart (plate-basket model) ────────────────────────────────────────────────
// A "Plate" is an independent basket of menu items from one vendor — e.g.
// Plate A = 3x Jollof Rice + 1x Egg + 1x Salad, Plate B = 1x Fufu + 1x Egusi
// + 1x Beef, both from the same vendor. This is NOT "N copies of the same
// item" — each plate can hold an entirely different combination of items.

export interface PlateLineItem {
  menuItemId: string;
  itemName: string;
  price: number;
  quantity: number;
}

export interface Plate {
  id: string;
  vendor: Vendor;
  label: string; // "Plate A", "Plate B", ... auto-assigned per vendor, in order created
  items: PlateLineItem[];
}

export interface FreeDeliveryPass {
  id: string;
  user_id: string;
  earned_from: string | null;
  is_used: boolean;
  expires_at: string;
  used_at: string | null;
  order_ref: string | null;
  created_at: string;
}

export interface ReferralStats {
  referral_code: string;
  total_referred: number;
  active_passes: number;
}

export interface BankDetails {
  id: string;
  user_id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  updated_at: string;
}

export interface WithdrawalRequest {
  id: string;
  vendor_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  notes: string | null;
  created_at: string;
}
