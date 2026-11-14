import { createFileRoute } from '@tanstack/react-router';
import { ServicePage } from '@/components/partner/OperationsPages';
import { partnerHead } from '@/lib/partner/metadata';
export const Route = createFileRoute('/store')({ head: () => partnerHead('Partner Store', 'View illustrative partner store information for ZIP partners.'), component: Page });
function Page() { return <ServicePage kind="store" />; }
