import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Gift, ChevronRight } from 'lucide-react';
import { TabPage } from '@/components/partner/Shell';
import { OfferMatrix } from '@/components/partner/OfferMatrix';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { partnerHead } from '@/lib/partner/metadata';
import { periodOffer } from '@/mocks';
export const Route = createFileRoute('/offers')({ head: () => partnerHead('Offers', 'Gig incentives and referral offers for ZIP partners.'), component: Offers });
function Offers() { const [details, setDetails] = useState(false); return <TabPage title="Your offers"><div className="space-y-5 p-4"><div className="flex items-center gap-3 bg-primary px-4 py-6 text-primary-foreground"><Gift className="h-7 w-7" /><h2 className="text-lg font-bold">Earn up to ₹{periodOffer.maximum} extra</h2></div><h2 className="text-sm font-bold">Active offers</h2><OfferMatrix onDetails={() => setDetails(true)} /><Button asChild variant="outline" className="h-16 w-full justify-between bg-card"><Link to="/refer"><span className="text-left"><b className="block text-sm">Refer & earn</b><span className="text-[10px] text-muted-foreground">Invite your next riding partner</span></span><ChevronRight /></Link></Button></div><Dialog open={details} onOpenChange={setDetails}><DialogContent className="max-w-[min(390px,calc(100%-32px))]"><DialogTitle>{periodOffer.title}</DialogTitle><DialogDescription>Illustrative incentive conditions. No real payout is made.</DialogDescription>{periodOffer.tiers.map(tier => <p key={tier.reward} className="flex justify-between text-xs"><span>{tier.gigs} gigs + {tier.orders} orders</span><b>₹{tier.reward}</b></p>)}<p className="border-t pt-3 text-xs">Compulsory login: {periodOffer.loginWindows.join(' and ')}. All conditions must be met.</p><Button asChild><Link to="/shifts">Book eligible gigs</Link></Button></DialogContent></Dialog></TabPage>; }
