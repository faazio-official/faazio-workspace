import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useContext } from "react";
import { PartnerContext } from "@/lib/partner/context";
import { PartnerProvider, usePartner } from "@/lib/partner/store";

afterEach(cleanup);
function Consumer() {
  const partner = usePartner();
  const direct = useContext(PartnerContext);
  return <button onClick={() => partner.setOnDuty(false)}>{direct === partner ? String(partner.onDuty) : "different context"}</button>;
}
describe("Partner provider", () => {
  it("shares one context between the provider, hook and direct consumers", () => {
    render(<PartnerProvider><Consumer /></PartnerProvider>);
    fireEvent.click(screen.getByRole("button", { name: "true" }));
    expect(screen.getByRole("button", { name: "false" })).toBeInTheDocument();
  });
});