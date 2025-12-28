import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { UserProfileProvider } from "@/contexts/UserProfileContext";
import { useEffect } from "react";
import { logEvent } from "@/lib/conversionTracker";
import { initTrackIt } from "@/lib/trackitAnalytics";
import ScrollToTop from "@/components/ScrollToTop";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Session from "./pages/Session";
import Claims from "./pages/Claims";
import Admin from "./pages/Admin";
import Pricing from "./pages/Pricing";
import Demo from "./pages/Demo";
import NotFound from "./pages/NotFound";
import Ideas from "./pages/Ideas";
import Pending from "./pages/Pending";
import Active from "./pages/Active";
import NewApplication from "./pages/NewApplication";
import Drafts from "./pages/Drafts";
import Check from "./pages/Check";
import IdeaDetail from "./pages/IdeaDetail";
import PaymentReturn from "./pages/PaymentReturn";
import SelectSupabaseProject from "./pages/SelectSupabaseProject";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const RouteTracker = () => {
  const location = useLocation();

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
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/auth" element={<Auth />} />
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </UserProfileProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
