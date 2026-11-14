import { createFileRoute } from '@tanstack/react-router';
import { CashPage } from '@/components/partner/OperationsPages';
import { partnerHead } from '@/lib/partner/metadata';
export const Route = createFileRoute('/cash')({ head: () => partnerHead('Floating Cash', 'Track cash collected on completed deliveries.'), component: CashPage });
