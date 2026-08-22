import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { HelmetProvider } from "react-helmet-async";
import { ScrollToTop } from "./components/ScrollToTop";
import { AuthProvider } from "./hooks/useAuth";

// Landing is the most common entry point and carries the LCP, so it stays
// eager — lazy-loading it would only add a chunk round-trip to the page that
// matters most. Everything else is split so a visitor who lands on "/" no
// longer downloads the docs page, the blog, recharts and every PDF tool.
// See _internal/BASELINE-PERF.md.
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Settings = lazy(() => import("./pages/Settings"));
const Docs = lazy(() => import("./pages/Docs"));
const Status = lazy(() => import("./pages/Status"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Pricing = lazy(() => import("./pages/Pricing"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const Create = lazy(() => import("./pages/Create"));
const ImagesToPdf = lazy(() => import("./pages/ImagesToPdf"));
const TextToPdfFeature = lazy(() => import("./pages/TextToPdfFeature"));
const ImageToPdfFeature = lazy(() => import("./pages/ImageToPdfFeature"));
const MergePdf = lazy(() => import("./pages/MergePdf"));
const SplitPdf = lazy(() => import("./pages/SplitPdf"));
const CompressPdf = lazy(() => import("./pages/CompressPdf"));
const PdfToImages = lazy(() => import("./pages/PdfToImages"));
const ApiPlayground = lazy(() => import("./pages/ApiPlayground"));
const AdminSecurity = lazy(() => import("./pages/AdminSecurity"));
const Admin = lazy(() => import("./pages/Admin"));
const ResizeImage = lazy(() => import("./pages/ResizeImage"));
const IdPhotoCrop = lazy(() => import("./pages/IdPhotoCrop"));
const RotatePdf = lazy(() => import("./pages/RotatePdf"));
const DeletePages = lazy(() => import("./pages/DeletePages"));
const ReorderPages = lazy(() => import("./pages/ReorderPages"));
const SscSignatureSize = lazy(() => import("./pages/exam/SscSignatureSize"));
const UpscPhotoSignatureSize = lazy(() => import("./pages/exam/UpscPhotoSignatureSize"));

const queryClient = new QueryClient();

// Full-height placeholder so swapping it for the real page does not shift
// layout. CLS is 0.00 today and must stay that way.
const RouteFallback = () => (
  <div className="min-h-screen bg-background" aria-busy="true" aria-live="polite" />
);

const App = () => (
  <HelmetProvider>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/app" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/docs" element={<Docs />} />
                <Route path="/status" element={<Status />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/blog/:slug" element={<BlogPost />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/create" element={<Create />} />
                <Route path="/images-to-pdf" element={<ImagesToPdf />} />
                <Route path="/text-to-pdf" element={<TextToPdfFeature />} />
                <Route path="/image-to-pdf" element={<ImageToPdfFeature />} />
                <Route path="/merge-pdf" element={<MergePdf />} />
                <Route path="/split-pdf" element={<SplitPdf />} />
                <Route path="/compress-pdf" element={<CompressPdf />} />
                {/* Same lazy chunk as /compress-pdf — presetKB is the only
                    difference, so these five routes cost nothing extra in
                    bundle size. See routeMeta.ts for why these five sizes. */}
                <Route path="/compress-pdf-to-200kb" element={<CompressPdf presetKB={200} />} />
                <Route path="/compress-pdf-to-100kb" element={<CompressPdf presetKB={100} />} />
                <Route path="/compress-pdf-to-500kb" element={<CompressPdf presetKB={500} />} />
                <Route path="/compress-pdf-to-300kb" element={<CompressPdf presetKB={300} />} />
                <Route path="/compress-pdf-to-50kb" element={<CompressPdf presetKB={50} />} />

                {/* Phase 2 additions — image-to-KB, ID photo crop, page ops, exam pages */}
                <Route path="/resize-image" element={<ResizeImage />} />
                <Route path="/compress-image-to-20kb" element={<ResizeImage presetKB={20} defaultTab="photo" />} />
                <Route path="/resize-signature-to-10kb" element={<ResizeImage presetKB={10} defaultTab="signature" />} />
                <Route path="/id-photo-crop" element={<IdPhotoCrop />} />
                <Route path="/rotate-pdf" element={<RotatePdf />} />
                <Route path="/delete-pdf-pages" element={<DeletePages />} />
                <Route path="/reorder-pdf-pages" element={<ReorderPages />} />
                <Route path="/exam/ssc-signature-size" element={<SscSignatureSize />} />
                <Route path="/exam/upsc-photo-signature-size" element={<UpscPhotoSignatureSize />} />
                <Route path="/pdf-to-images" element={<PdfToImages />} />
                <Route path="/api-playground" element={<ApiPlayground />} />
                <Route path="/admin/security" element={<AdminSecurity />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </HelmetProvider>
);

export default App;
