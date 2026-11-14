import { createFileRoute } from '@tanstack/react-router';
import { ServicePage } from '@/components/partner/OperationsPages';
import { partnerHead } from '@/lib/partner/metadata';
export const Route = createFileRoute('/club')({ head: () => partnerHead('Partner Club', 'View illustrative partner club information for ZIP partners.'), component: Page });
function Page() { return <ServicePage kind="club" />; }
