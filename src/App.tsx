import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { Toaster } from '@/components/ui/sonner'
import {
  NavAccessRoute,
  OnboardingRoute,
  ProtectedRoute,
  PublicOnlyRoute,
  SetupRoute,
} from '@/components/auth/ProtectedRoute'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { AgentPage } from '@/pages/agent'
import { AgentDetailPage } from '@/pages/agent/detail'
import { AuthCallbackPage } from '@/pages/auth/callback'
import { DashboardPage } from '@/pages/dashboard'
import { ForgotPasswordPage } from '@/pages/forgot-password'
import { InvitePage } from '@/pages/invite'
import { LocationsPage } from '@/pages/locations'
import { LoginPage } from '@/pages/login'
import { NewCallPage } from '@/pages/new-call'
import { OnboardingPage } from '@/pages/onboarding'
import { ReviewPage } from '@/pages/review'
import { ResetPasswordPage } from '@/pages/reset-password'
import { SchedulePage } from '@/pages/schedule'
import { ScorecardPage } from '@/pages/scorecard'
import { ScorecardDetailPage } from '@/pages/scorecard/detail'
import { SettingsPage } from '@/pages/settings'
import { SetupPage } from '@/pages/setup'
import { SupportPage } from '@/pages/support'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>

          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/invite/:token" element={<InvitePage />} />

          <Route element={<OnboardingRoute />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
          </Route>

          <Route element={<SetupRoute />}>
            <Route path="/setup" element={<SetupPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<NavAccessRoute />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <DashboardLayout>
                  <DashboardPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/locations"
              element={
                <DashboardLayout>
                  <LocationsPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/scorecard"
              element={
                <DashboardLayout>
                  <ScorecardPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/scorecard/:id"
              element={
                <DashboardLayout>
                  <ScorecardDetailPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/review"
              element={
                <DashboardLayout>
                  <ReviewPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/agent"
              element={
                <DashboardLayout>
                  <AgentPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/agent/:id"
              element={
                <DashboardLayout>
                  <AgentDetailPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/new-call"
              element={
                <DashboardLayout>
                  <NewCallPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/schedule"
              element={
                <DashboardLayout>
                  <SchedulePage />
                </DashboardLayout>
              }
            />
            <Route
              path="/settings"
              element={
                <DashboardLayout>
                  <SettingsPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/support"
              element={
                <DashboardLayout>
                  <SupportPage />
                </DashboardLayout>
              }
            />
            </Route>
          </Route>

          <Route path="/signup" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster richColors closeButton position="bottom-right" />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
