import { createFileRoute } from '@tanstack/react-router';
import { DisputesPage } from '@/components/partner/OperationsPages';
import { partnerHead } from '@/lib/partner/metadata';
export const Route = createFileRoute('/disputes')({ head: () => partnerHead('Order Issues', 'Record mock delivery and payment issues.'), component: DisputesPage });
