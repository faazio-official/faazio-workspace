import { useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DURATION, EASE } from "@/lib/motion";
import type { SellerJourneyScreen, SellerJourneyStep } from "@/lib/tutorials/seller-journey";
import { TourCursor } from "./tour-cursor";
import {
  AccountScreen,
  FeeRequestScreen,
  RegistrationScreen,
  ReviewScreen,
  type ScreenProps,
} from "./screens";
import {
  AddonsScreen,
  AdsScreen,
  AdsWizardScreen,
  AnalyticsScreen,
  CatalogAddScreen,
  CatalogEditScreen,
  CatalogListScreen,
  CatalogTrashScreen,
  ExploreScreen,
  HubScreen,
  InventoryScreen,
  InviteAcceptScreen,
  MenusScreen,
  NotificationsScreen,
  OffersScreen,
  OrdersBoardScreen,
  OrderHistoryScreen,
  OrdersDetailScreen,
  OrdersRejectScreen,
  OutletInfoScreen,
  PayoutsScreen,
  PickupQrScreen,
  PrescriptionsScreen,
  PricingScreen,
  RestaurantStatusScreen,
  ReturnsScreen,
  ReviewsScreen,
  RxDetailScreen,
  RushHourScreen,
  SettingsScreen,
  StoreCreateScreen,
  StoreLoginScreen,
  StoreOrdersScreen,
  StoreProductsEmptyScreen,
  StatusOfflineScreen,
  StoreScreen,
  StoreSwitcherScreen,
  SupportScreen,
} from "./screens-journey";

export const SCREENS: Record<SellerJourneyScreen, ComponentType<ScreenProps>> = {
  account: AccountScreen,
  registration: RegistrationScreen,
  review: ReviewScreen,
  "store-login": StoreLoginScreen,
  "store-orders": StoreOrdersScreen,
  "store-products": StoreProductsEmptyScreen,
  store: StoreScreen,
  "store-create": StoreCreateScreen,
  "store-switcher": StoreSwitcherScreen,
  "catalog-list": CatalogListScreen,
  "catalog-add": CatalogAddScreen,
  "catalog-edit": CatalogEditScreen,
  "catalog-trash": CatalogTrashScreen,
  pricing: PricingScreen,
  inventory: InventoryScreen,
  menus: MenusScreen,
  offers: OffersScreen,
  addons: AddonsScreen,
  "orders-board": OrdersBoardScreen,
  "orders-detail": OrdersDetailScreen,
  "orders-reject": OrdersRejectScreen,
  "order-history": OrderHistoryScreen,
  "pickup-qr": PickupQrScreen,
  notifications: NotificationsScreen,
  payouts: PayoutsScreen,
  settings: SettingsScreen,
  returns: ReturnsScreen,
  ads: AdsScreen,
  "ads-wizard": AdsWizardScreen,
  analytics: AnalyticsScreen,
  reviews: ReviewsScreen,
  prescriptions: PrescriptionsScreen,
  "rx-detail": RxDetailScreen,
  explore: ExploreScreen,
  hub: HubScreen,
  "outlet-info": OutletInfoScreen,
  "restaurant-status": RestaurantStatusScreen,
  "status-offline": StatusOfflineScreen,
  "rush-hour": RushHourScreen,
  support: SupportScreen,
  "fee-request": FeeRequestScreen,
  "invite-accept": InviteAcceptScreen,
};

/** The verb shown on the stage callout beside the pressed control's label. */
const ACTION_VERB: Record<SellerJourneyStep["action"], string> = {
  tap: "Tap",
  type: "Type in",
  scan: "Scan",
  swipe: "Swipe",
};

type TargetRect = { x: number; y: number; width: number; height: number };

/** Screens that render the real mobile app: no stage padding, app chrome. */
const DEVICE_SCREENS = new Set<SellerJourneyScreen>([
  "account",
  "registration",
  "review",
  "fee-request",
]);

/**
 * Where the step's target sits vertically in the phone, as a fraction of the
 * screen. The app screens scroll (`AppScroll`), so a step is a scroll position.
 */
const FOCUS: Partial<Record<SellerJourneyScreen, number>> = {
  account: 0.58,
  review: 0.52,
  "fee-request": 0.5,
};

export function TourStage({
  step,
  pressed,
  rippleKey,
}: {
  step: SellerJourneyStep;
  pressed: boolean;
  rippleKey: number;
}) {
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<TargetRect | null>(null);
  const Screen = SCREENS[step.screen];
  const focus = FOCUS[step.screen] ?? 0.4;

  // One layout effect owns both halves of the device stages: scroll the app
  // screen to the step's section, then place the ring on the target. Both use
  // layout offsets (`offsetTop`/`offsetHeight`), never rects, because the
  // reduced-motion reset gives every element a 0.01ms transition and a rect
  // read can therefore lag the transform by a frame.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    /** Offset of `el` inside `root`, walking `offsetParent` so transformed
     *  ancestors and intermediate wrappers cannot distort it. */
    let raf = 0;
    let tries = 0;

    const offsetIn = (el: HTMLElement, root: HTMLElement) => {
      let x = 0;
      let y = 0;
      let node: HTMLElement | null = el;
      while (node && node !== root) {
        x += node.offsetLeft;
        y += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      return node === root ? { x, y } : null;
    };

    const place = (retry: boolean) => {
      const target = stage.querySelector<HTMLElement>(`[data-tour-target="${step.target}"]`);
      if (!target || target.offsetParent === null) {
        setRect(null);
        if (retry && tries++ < 90) raf = window.requestAnimationFrame(() => place(true));
        return;
      }

      /** Keeps the ring (grown 4px each side) fully inside the phone frame, so a
       *  target pinned to an edge — a sticky header — is never clipped. */
      const clamp = (box: TargetRect): TargetRect => {
        const inset = 6;
        const width = Math.min(box.width, stage.clientWidth - inset * 2);
        const height = Math.min(box.height, stage.clientHeight - inset * 2);
        return {
          x: Math.min(Math.max(box.x, inset + width / 2), stage.clientWidth - inset - width / 2),
          y: Math.min(Math.max(box.y, inset + height / 2), stage.clientHeight - inset - height / 2),
          width,
          height,
        };
      };

      const inner = Array.from(stage.querySelectorAll<HTMLElement>(".ta-scroll-inner")).find(
        (node) => node.contains(target),
      );
      const scroller = inner?.parentElement;
      const offset = inner ? offsetIn(target, inner) : null;

      if (inner && scroller && offset) {
        const view = scroller.clientHeight;
        if (view > 0) {
          const max = Math.max(0, inner.offsetHeight - view);
          const desired = offset.y + target.offsetHeight / 2 - view * focus;
          const scroll = -Math.max(0, Math.min(desired, max));
          inner.style.transform = `translateY(${scroll}px)`;
          const stageRect = stage.getBoundingClientRect();
          setRect(
            clamp({
              x:
                inner.getBoundingClientRect().left -
                stageRect.left +
                offset.x +
                target.offsetWidth / 2,
              y:
                scroller.getBoundingClientRect().top -
                stageRect.top +
                offset.y +
                scroll +
                target.offsetHeight / 2,
              width: target.offsetWidth,
              height: target.offsetHeight,
            }),
          );
          return;
        }
      }

      const a = target.getBoundingClientRect();
      const b = stage.getBoundingClientRect();
      setRect(
        clamp({
          x: a.left - b.left + a.width / 2,
          y: a.top - b.top + a.height / 2,
          width: a.width,
          height: a.height,
        }),
      );
    };

    place(true);

    const replace = () => place(false);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(replace);
    observer?.observe(stage);
    window.addEventListener("resize", replace);
    return () => {
      window.cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener("resize", replace);
    };
  }, [step.id, step.screen, step.target, focus]);

  return (
    <div className="tour-stage-wrap">
      <div className="tour-stage" ref={stageRef} aria-hidden="true">
        <AnimatePresence initial={false}>
          <motion.div
            // Keyed by screen, not step: the registration form is one screen the
            // walkthrough scrolls, exactly as the app behaves. Only a change of
            // screen cross-fades.
            key={step.screen}
            className="tour-screen"
            data-device={DEVICE_SCREENS.has(step.screen) || undefined}
            data-portal={!DEVICE_SCREENS.has(step.screen) || undefined}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: DURATION.exit, ease: EASE.entrance } }}
            transition={{ duration: DURATION.enter, ease: EASE.entrance }}
          >
            <Screen activeTarget={step.target} />
          </motion.div>
        </AnimatePresence>

        {rect ? (
          <span
            key={step.id}
            className="tour-ring"
            style={{
              left: rect.x - rect.width / 2 - 4,
              top: rect.y - rect.height / 2 - 4,
              width: rect.width + 8,
              height: rect.height + 8,
            }}
          />
        ) : null}

        {rect ? (
          <span
            key={`${step.id}-callout`}
            className="tour-callout"
            data-below={rect.y < 70 || undefined}
            style={{
              left: Math.min(Math.max(rect.x, 78), (stageRef.current?.clientWidth ?? 330) - 78),
              top: rect.y < 70 ? rect.y + rect.height / 2 + 14 : rect.y - rect.height / 2 - 14,
            }}
          >
            <span className="tour-callout-verb" aria-hidden="true">
              {ACTION_VERB[step.action]}
            </span>
            {step.control}
          </span>
        ) : null}

        {!reduced && rect ? (
          <TourCursor
            x={rect.x}
            y={rect.y}
            pressed={pressed}
            rippleKey={rippleKey}
            action={step.action}
          />
        ) : null}
      </div>
      <p className="tour-disclaimer">
        An illustration of the Faazio app and seller portal. Nothing on this page submits an
        application or changes an account.
      </p>
    </div>
  );
}
