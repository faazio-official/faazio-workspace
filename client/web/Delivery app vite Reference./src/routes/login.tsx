import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Bike } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePartner } from "@/lib/partner/store";
import { partner } from "@/mocks";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in · ZIP Partner" }, { name: "description", content: "Sign in to the ZIP delivery partner app." }, { property: "og:title", content: "Sign in · ZIP Partner" }, { property: "og:description", content: "Sign in to the ZIP delivery partner app." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Login,
});

function Login() {
  const { login } = usePartner();
  const navigate = useNavigate();
  const [email, setEmail] = useState(partner.email);
  const [pw, setPw] = useState("");
  return (
    <div className="min-h-screen">
      <div className="flex flex-col items-center border-b bg-card px-6 pb-14 pt-20 text-foreground">
        <div className="rounded-lg bg-card p-4 text-primary"><Bike className="h-10 w-10" /></div>
        <h1 className="mt-4 text-2xl font-bold">ZIP Partner</h1><p className="text-sm opacity-90">Deliver. Earn. Repeat.</p>
      </div>
      <form className="space-y-4 p-6" onSubmit={(e) => { e.preventDefault(); if (login(email, pw)) { toast.success("Welcome back!"); navigate({ to: "/" }); } else toast.error("Invalid email or password"); }}>
        <div><label className="text-xs text-muted-foreground">Email</label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div><label className="text-xs text-muted-foreground">Password</label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required /></div>
        <Button type="submit" size="lg" className="w-full">Sign In</Button>
        <p className="text-center text-[11px] text-muted-foreground">Demo password: {partner.password}</p>
      </form>
    </div>
  );
}
