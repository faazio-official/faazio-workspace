import { createFileRoute } from '@tanstack/react-router';
import { InboxPage } from '@/components/partner/OperationsPages';
import { partnerHead } from '@/lib/partner/metadata';
export const Route = createFileRoute('/inbox')({ head: () => partnerHead('Inbox', 'Partner updates and delivery messages.'), component: InboxPage });
