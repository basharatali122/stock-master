import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Lazy load pages for better performance
const Auth = lazy(() => import("@/pages/Auth"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Products = lazy(() => import("@/pages/Products"));
const RoutesPage = lazy(() => import("@/pages/Routes"));
const Shops = lazy(() => import("@/pages/Shops"));
const Orders = lazy(() => import("@/pages/Orders"));
const Returns = lazy(() => import("@/pages/Returns"));
const Users = lazy(() => import("@/pages/Users"));
const Financials = lazy(() => import("@/pages/Financials"));
const Cities = lazy(() => import("@/pages/Cities"));
const Reports = lazy(() => import("@/pages/Reports"));
const Settings = lazy(() => import("@/pages/Settings"));
const MyRoutes = lazy(() => import("@/pages/MyRoutes"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// Optimized QueryClient with better caching and performance settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 3, // 3 minutes - data stays fresh longer
      gcTime: 1000 * 60 * 15, // 15 minutes cache retention
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
    mutations: {
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Navigate to="/auth" replace />} />
              <Route path="/auth" element={<Auth />} />
              
              {/* Protected Routes */}
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                
                {/* Admin-only routes */}
                <Route path="/cities" element={
                  <ProtectedRoute requireAdmin>
                    <Cities />
                  </ProtectedRoute>
                } />
                <Route path="/routes" element={
                  <ProtectedRoute requireAdmin>
                    <RoutesPage />
                  </ProtectedRoute>
                } />
                <Route path="/users" element={
                  <ProtectedRoute requireAdmin>
                    <Users />
                  </ProtectedRoute>
                } />
                <Route path="/financials" element={
                  <ProtectedRoute requireAdmin>
                    <Financials />
                  </ProtectedRoute>
                } />
                <Route path="/reports" element={
                  <ProtectedRoute requireAdmin>
                    <Reports />
                  </ProtectedRoute>
                } />
                
                {/* Available to all authenticated users */}
                <Route path="/my-routes" element={<MyRoutes />} />
                <Route path="/shops" element={<Shops />} />
                <Route path="/products" element={<Products />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/returns" element={<Returns />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;