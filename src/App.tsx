import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import RoutesPage from "@/pages/Routes";
import Shops from "@/pages/Shops";
import Orders from "@/pages/Orders";
import Returns from "@/pages/Returns";
import Users from "@/pages/Users";
import Financials from "@/pages/Financials";
import Cities from "@/pages/Cities";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import MyRoutes from "@/pages/MyRoutes";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
