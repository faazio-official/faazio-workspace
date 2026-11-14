import { createFileRoute } from '@tanstack/react-router';
import { ProfilePage } from '@/components/partner/OperationsPages';
import { partnerHead } from '@/lib/partner/metadata';
export const Route = createFileRoute('/profile')({ head: () => partnerHead('My Profile', 'Your ZIP partner identity and delivery details.'), component: ProfilePage });
