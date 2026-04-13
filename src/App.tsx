import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { HelmetProvider } from "react-helmet-async";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Settings from "./pages/Settings";
import Docs from "./pages/Docs";
import Analytics from "./pages/Analytics";
import Status from "./pages/Status";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Pricing from "./pages/Pricing";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import NotFound from "./pages/NotFound";
import ImagesToPdf from "./pages/ImagesToPdf";
import TextToPdfFeature from "./pages/TextToPdfFeature";
import ImageToPdfFeature from "./pages/ImageToPdfFeature";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/app" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/status" element={<Status />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/images-to-pdf" element={<ImagesToPdf />} />
              <Route path="/text-to-pdf" element={<TextToPdfFeature />} />
              <Route path="/image-to-pdf" element={<ImageToPdfFeature />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </HelmetProvider>
);

export default App;
