/**
 * @mock Simulates a Go + PostgreSQL profile microservice. Consolidates account/
 * profile, orderStatus, accountNav, details into profile tables. See data/DATA_CONTROL.md.
 */
import type {
  UserProfile,
  SaverMembership,
  OrderStatusCount,
  AccountNavGroup,
  UserDetailsData,
} from '../types';
import { userProfile, saverMembership } from '../account/profile';
import { orderStatusCounts } from '../account/orderStatus';
import { accountNavGroups } from '../account/accountNav';
import { accountDetails } from '../account/details';

export interface ProfileRow extends UserProfile {
  id: string;
  accountId: string;
}

export const profileTable: ProfileRow[] = [
  {
    id: 'user-1',
    accountId: accountDetails.accountId,
    name: userProfile.name,
    email: userProfile.email,
    phone: userProfile.phone,
  },
];

export interface MembershipRow extends SaverMembership {
  id: string;
  userId: string;
}

export const membershipTable: MembershipRow[] = [
  { id: 'member-1', userId: 'user-1', title: saverMembership.title, savedLabel: saverMembership.savedLabel, savedAmount: saverMembership.savedAmount },
];

export interface OrderStatusRow extends OrderStatusCount {
  id: string;
  userId: string;
}

export const orderStatusTable: OrderStatusRow[] = orderStatusCounts.map((c) => ({
  id: `${c.key}-status`,
  userId: 'user-1',
  key: c.key,
  label: c.label,
  count: c.count,
}));

export interface NavRowGroup extends AccountNavGroup {
  userId: string;
}

export const navTable: NavRowGroup[] = accountNavGroups.map((g) => ({
  userId: 'user-1',
  key: g.key,
  rows: g.rows,
}));

export interface DetailsTable extends UserDetailsData {
  userId: string;
}

export const detailsTable: DetailsTable[] = [
  { userId: 'user-1', ...accountDetails },
];

export function getProfileByUserId(userId: string): ProfileRow | undefined {
  return profileTable.find((p) => p.id === userId);
}
