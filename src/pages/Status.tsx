import { useState, useEffect } from "react";
import { SITE_URL } from "@/lib/config";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Server,
  Database,
  Zap,
  Shield,
  Lock,
} from "lucide-react";
import { Link } from "react-router-dom";

type Status = "operational" | "degraded" | "down" | "checking";

interface ServiceCheck {
  name: string;
  status: Status;
  latency?: number;
  icon: typeof Server;
  description: string;
}

const Status = () => {
  const [infraServices, setInfraServices] = useState<ServiceCheck[]>([
    { name: "Backend Services", status: "checking", icon: Database, description: "API Gateway & Database" },
    { name: "Edge Functions", status: "checking", icon: Zap, description: "Serverless compute layer" },
    { name: "PDF Engine", status: "checking", icon: Server, description: "Client-side PDF generation" },
  ]);
  const [authServices, setAuthServices] = useState<ServiceCheck[]>([
    { name: "API Authentication", status: "checking", icon: Shield, description: "API key validation & rate limiting" },
  ]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [checking, setChecking] = useState(false);
  const [user, setUser] = useState<unknown>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const checkServices = async () => {
    setChecking(true);

    // --- Infrastructure checks (no auth needed) ---
    const infra: ServiceCheck[] = [];

    // 1. Backend Services (API + DB) via Supabase client
    try {
      const start = Date.now();
      const { error } = await supabase.from("profiles").select("id", { count: "exact", head: true });
      const latency = Date.now() - start;
      infra.push({
        name: "Backend Services",
        status: error ? "degraded" : "operational",
        latency,
        icon: Database,
        description: "API Gateway & Database",
      });
    } catch {
      infra.push({ name: "Backend Services", status: "down", icon: Database, description: "API Gateway & Database" });
    }

    // 2. Edge Functions via health-check endpoint (CORS-safe via Supabase client)
    try {
      const start = Date.now();
      const { data, error } = await supabase.functions.invoke("health-check");
      const latency = Date.now() - start;
      if (error || !data?.status || data.status !== "ok") {
        infra.push({ name: "Edge Functions", status: "degraded", latency, icon: Zap, description: "Serverless compute layer" });
      } else {
        infra.push({ name: "Edge Functions", status: "operational", latency, icon: Zap, description: "Serverless compute layer" });
      }
    } catch {
      infra.push({ name: "Edge Functions", status: "down", icon: Zap, description: "Serverless compute layer" });
    }

    // 3. PDF Engine — client-side library (always available if page loaded)
    try {
      const html2pdf = await import("html2pdf.js");
      infra.push({
        name: "PDF Engine",
        status: html2pdf ? "operational" : "degraded",
        icon: Server,
        description: "Client-side PDF generation",
      });
    } catch {
      infra.push({ name: "PDF Engine", status: "degraded", icon: Server, description: "Client-side PDF generation" });
    }

    setInfraServices(infra);

    // --- Authenticated deep checks (logged-in users only) ---
    if (user) {
      const auth: ServiceCheck[] = [];
      try {
        const start = Date.now();
        const { data, error } = await supabase.functions.invoke("auth-health-check");
        const latency = Date.now() - start;

        const isOperational = !error && data?.status === "ok" && data?.check === "authenticated";

        auth.push({
          name: "API Authentication",
          status: isOperational ? "operational" : "degraded",
          latency,
          icon: Shield,
          description: "Authenticated backend access",
        });
      } catch {
        auth.push({
          name: "API Authentication",
          status: "down",
          icon: Shield,
          description: "Authenticated backend access",
        });
      }
      setAuthServices(auth);
    }

    setLastChecked(new Date());
    setChecking(false);
  };

  useEffect(() => {
    checkServices();
  }, [user]);

  const allServices = user ? [...infraServices, ...authServices] : infraServices;
  const overallStatus = allServices.every((s) => s.status === "operational")
    ? "All Systems Operational"
    : allServices.some((s) => s.status === "down")
      ? "System Outage Detected"
      : allServices.some((s) => s.status === "checking")
        ? "Checking..."
        : "Partial Degradation";

  const overallColor = allServices.every((s) => s.status === "operational")
    ? "text-green-500"
    : allServices.some((s) => s.status === "down")
      ? "text-destructive"
      : allServices.some((s) => s.status === "checking")
        ? "text-muted-foreground"
        : "text-yellow-500";

  const renderServiceCard = (service: ServiceCheck) => (
    <Card key={service.name} className="p-5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <service.icon className="w-5 h-5 text-primary" />
        <div>
          <p className="font-medium text-foreground">{service.name}</p>
          <p className="text-xs text-muted-foreground">{service.description}</p>
          {service.latency !== undefined && (
            <p className="text-xs text-muted-foreground">{service.latency}ms response time</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {service.status === "operational" && <CheckCircle className="w-5 h-5 text-green-500" />}
        {service.status === "degraded" && <CheckCircle className="w-5 h-5 text-yellow-500" />}
        {service.status === "down" && <XCircle className="w-5 h-5 text-destructive" />}
        {service.status === "checking" && <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />}
        <span className={`text-sm capitalize ${
          service.status === "operational" ? "text-green-500" :
          service.status === "degraded" ? "text-yellow-500" :
          service.status === "down" ? "text-destructive" : "text-muted-foreground"
        }`}>
          {service.status}
        </span>
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title="System Status — PDFly by 3idhMind"
        description="Check the real-time status of PDFly services. Monitor API Gateway, Database, and PDF Generation uptime."
        keywords="PDFly status, PDF API status, system uptime, 3idhMind status"
        canonical={`${SITE_URL}/status`}
      />
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-3xl flex-1">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold font-display text-foreground mb-2">System Status</h1>
          <p className={`text-lg font-semibold ${overallColor}`}>{overallStatus}</p>
          {lastChecked && (
            <p className="text-xs text-muted-foreground mt-1">
              Last checked: {lastChecked.toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Infrastructure Health */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Server className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Infrastructure Health</h2>
          </div>
          <div className="space-y-3">
            {infraServices.map(renderServiceCard)}
          </div>
        </div>

        {/* Authenticated Deep Checks */}
        {user ? (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-4 h-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Deep Service Checks</h2>
            </div>
            <div className="space-y-3">
              {authServices.map(renderServiceCard)}
            </div>
          </div>
        ) : (
          <div className="mb-8 p-4 rounded-lg border border-border bg-muted/50 text-center">
            <Lock className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              <Link to="/auth" className="text-primary hover:underline">Sign in</Link> to view deep service checks
            </p>
          </div>
        )}

        <div className="text-center">
          <Button onClick={checkServices} disabled={checking} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Checking..." : "Refresh Status"}
          </Button>
        </div>

        <div className="mt-8 pt-6 border-t border-border text-center">
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" size="sm" asChild><Link to="/app">PDF Generator</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/pricing">Pricing</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/docs">API Docs</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/blog">Blog</Link></Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Status;
