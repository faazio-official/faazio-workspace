import { createFileRoute } from '@tanstack/react-router';
import { SupportPage } from '@/components/partner/OperationsPages';
import { partnerHead } from '@/lib/partner/metadata';
export const Route = createFileRoute('/support')({ head: () => partnerHead('Partner Support', 'Get help with your ZIP partner account.'), component: SupportPage });
