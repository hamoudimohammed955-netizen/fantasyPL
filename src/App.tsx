import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ThemeProvider } from "next-themes";
import { lazy, Suspense } from "react";
import ProtectedRoute from "./pages/ProtectedRoute";

// Lazy-load all pages — each page loads only when needed
const Auth         = lazy(() => import('./pages/Auth'));
const Groups       = lazy(() => import('./pages/Groups'));
const GroupDetails = lazy(() => import('./pages/GroupDetails'));
const Points       = lazy(() => import('./pages/Points'));
const Rankings     = lazy(() => import('./pages/Rankings'));
const Chat         = lazy(() => import('./pages/Chat'));
const Profile      = lazy(() => import('./pages/Profile'));
const NotFound     = lazy(() => import('./pages/NotFound'));
const Join         = lazy(() => import('./pages/Join'));
const MemberDetails= lazy(() => import('./pages/MemberDetails'));

// Optimized QueryClient — no retries, fast stale time
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={null}>
              <Routes>
                <Route path="/" element={<Navigate to="/auth" replace />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/join/:code" element={<Join />} />
                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<Navigate to="/groups" replace />} />
                  <Route path="/groups" element={<Groups />} />
                  <Route path="/group/:id" element={<GroupDetails />} />
                  <Route path="/member/:userId/:groupId" element={<MemberDetails />} />
                  <Route path="/points" element={<Points />} />
                  <Route path="/rankings" element={<Rankings />} />
                  <Route path="/chat" element={<Chat />} />
                  <Route path="/profile" element={<Profile />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;