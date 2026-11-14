import { createFileRoute } from '@tanstack/react-router';
import { ServicePage } from '@/components/partner/OperationsPages';
import { partnerHead } from '@/lib/partner/metadata';
export const Route = createFileRoute('/insurance')({ head: () => partnerHead('Insurance', 'View illustrative insurance information for ZIP partners.'), component: Page });
function Page() { return <ServicePage kind="insurance" />; }
