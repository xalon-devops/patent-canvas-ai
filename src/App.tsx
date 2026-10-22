import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { UserProfileProvider } from "@/contexts/UserProfileContext";
import React, { lazy, Suspense, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { logEvent } from "@/lib/conversionTracker";
import { initTrackIt } from "@/lib/trackitAnalytics";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";
import ScrollToTop from "@/components/ScrollToTop";
import ProtectedRoute from "./components/ProtectedRoute";
import Index from "./pages/Index";

// After a deploy, old chunk URLs 404. Reload once to pick up the new build instead of crashing.
const lazyPage = <T extends React.ComponentType<any>>(load: () => Promise<{ default: T }>) =>
  lazy(() =>
    load().catch((err) => {
      const key = "chunk-reload-at";
      let last = 0;
      try { last = Number(sessionStorage.getItem(key) || 0); } catch { /* storage blocked */ }
      if (Date.now() - last > 10_000) {
        try { sessionStorage.setItem(key, String(Date.now())); } catch { /* storage blocked */ }
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    })
  );

const Auth = lazyPage(() => import("./pages/Auth"));
const Dashboard = lazyPage(() => import("./pages/Dashboard"));
const Session = lazyPage(() => import("./pages/Session"));
const Claims = lazyPage(() => import("./pages/Claims"));
const Admin = lazyPage(() => import("./pages/Admin"));
const Pricing = lazyPage(() => import("./pages/Pricing"));
const Demo = lazyPage(() => import("./pages/Demo"));
const NotFound = lazyPage(() => import("./pages/NotFound"));
const Ideas = lazyPage(() => import("./pages/Ideas"));
const Pending = lazyPage(() => import("./pages/Pending"));
const Active = lazyPage(() => import("./pages/Active"));
const Analytics = lazyPage(() => import("./pages/Analytics"));
const NewApplication = lazyPage(() => import("./pages/NewApplication"));
const Drafts = lazyPage(() => import("./pages/Drafts"));
const Check = lazyPage(() => import("./pages/Check"));
const TrademarkCheck = lazyPage(() => import("./pages/TrademarkCheck"));
const TrademarkApplication = lazyPage(() => import("./pages/TrademarkApplication"));
const IdeaDetail = lazyPage(() => import("./pages/IdeaDetail"));
const PaymentReturn = lazyPage(() => import("./pages/PaymentReturn"));
const SelectSupabaseProject = lazyPage(() => import("./pages/SelectSupabaseProject"));
const Settings = lazyPage(() => import("./pages/Settings"));
const Profile = lazyPage(() => import("./pages/Profile"));
const ResetPassword = lazyPage(() => import("./pages/ResetPassword"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 30_000 },
  },
});

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// Per-route boundary: a crash on one page no longer takes down the whole app,
// and navigating elsewhere (new key) resets it.
const RouteBoundary = ({ children }: { children: React.ReactNode }) => {
  const { pathname } = useLocation();
  return <ErrorBoundary key={pathname}>{children}</ErrorBoundary>;
};

const RouteTracker = () => {
  const location = useLocation();
  
  // Funnel tracking hook - tracks page views automatically
  useFunnelTracking();

  useEffect(() => {
    // Initialize TrackIt analytics on first render
    initTrackIt();
  }, []);

  useEffect(() => {
    logEvent("page_view", {}, "PatentBot AI™");
  }, [location.pathname]);

  return null;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <UserProfileProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <RouteTracker />
          <RouteBoundary>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route 
              path="/payment/return" 
              element={
                <ProtectedRoute>
                  <PaymentReturn />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/ideas" 
              element={
                <ProtectedRoute>
                  <Ideas />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/pending" 
              element={
                <ProtectedRoute>
                  <Pending />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/active" 
              element={
                <ProtectedRoute>
                  <Active />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/analytics" 
              element={
                <ProtectedRoute>
                  <Analytics />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/new-application" 
              element={
                <ProtectedRoute>
                  <NewApplication />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/select-supabase-project" 
              element={
                <ProtectedRoute>
                  <SelectSupabaseProject />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/drafts" 
              element={
                <ProtectedRoute>
                  <Drafts />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/check" 
              element={
                <ProtectedRoute>
                  <Check />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/idea/:id" 
              element={
                <ProtectedRoute>
                  <IdeaDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/session/:id" 
              element={
                <ProtectedRoute>
                  <Session />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute requiresAdmin>
                  <Admin />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/session/:id/claims" 
              element={
                <ProtectedRoute>
                  <Claims />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/trademark-check" 
              element={
                <ProtectedRoute>
                  <TrademarkCheck />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/trademark-application" 
              element={
                <ProtectedRoute>
                  <TrademarkApplication />
                </ProtectedRoute>
              } 
            />
            {/* Resume a saved trademark application */}
            <Route 
              path="/trademark-application/:id" 
              element={
                <ProtectedRoute>
                  <TrademarkApplication />
                </ProtectedRoute>
              } 
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </RouteBoundary>
        </BrowserRouter>
      </TooltipProvider>
      </UserProfileProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
