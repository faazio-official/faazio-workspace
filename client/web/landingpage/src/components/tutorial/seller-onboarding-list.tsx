import { HiOutlineCheckCircle } from "react-icons/hi2";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SELLER_TOUR_STEPS } from "@/lib/tutorials/seller-onboarding";
import { StepDemo } from "./step-demo";

/**
 * FAQ-style list: each row is one step. Opening it mounts exactly one screen
 * and one hand animation; the requirements for that step sit below the
 * animation, still inside the same dropdown.
 */
export function SellerOnboardingList() {
  return (
    <div className="onboarding">
      <Accordion
        type="single"
        collapsible
        defaultValue={SELLER_TOUR_STEPS[0]?.id}
        className="onboarding-list"
      >
        {SELLER_TOUR_STEPS.map((step, index) => (
          <AccordionItem
            key={step.id}
            value={step.id}
            id={`step-${step.id}`}
            className="onboarding-item"
          >
            <AccordionTrigger className="onboarding-trigger py-5 hover:no-underline">
              <span className="onboarding-trigger-main">
                <span className="onboarding-num" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="onboarding-title">{step.title}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-7">
              <div className="onboarding-panel">
                <p className="onboarding-detail">{step.detail}</p>
                <StepDemo step={step} />
                <div className="onboarding-needs">
                  <h3>What you need</h3>
                  <ul>
                    {step.requirements.map((item) => (
                      <li key={item}>
                        <HiOutlineCheckCircle aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <p className="tour-disclaimer">
        An illustration of the Faazio app. Nothing on this page submits an application.
      </p>
    </div>
  );
}
