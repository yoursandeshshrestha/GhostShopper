import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider'
import { Toaster } from '@/components/ui/sonner'
import {
  NavAccessRoute,
  OnboardingRoute,
  ProtectedRoute,
  PublicOnlyRoute,
  SetupRoute,
} from '@/components/auth/ProtectedRoute'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { AdminOverviewPage } from '@/pages/admin'
import { AdminCallsPage } from '@/pages/admin/calls'
import { AdminOrganisationsPage } from '@/pages/admin/organisations'
import { AdminOrganisationDetailPage } from '@/pages/admin/organisations/detail'
import { AdminUsersPage } from '@/pages/admin/users'
import { AdminVoicesPage } from '@/pages/admin/voices'
import { AgentPage } from '@/pages/agent'
import { AgentDetailPage } from '@/pages/agent/detail'
import { AuthCallbackPage } from '@/pages/auth/callback'
import { DashboardPage } from '@/pages/dashboard'
import { InvitePage } from '@/pages/invite'
import { LocationsPage } from '@/pages/locations'
import { LoginPage } from '@/pages/login'
import { AccountSuspendedPage } from '@/pages/account-suspended'
import { OnboardingPage } from '@/pages/onboarding'
import { ReviewPage } from '@/pages/review'
import { SchedulePage } from '@/pages/schedule'
import { ScorecardPage } from '@/pages/scorecard'
import { ScorecardDetailPage } from '@/pages/scorecard/detail'
import { SettingsPage } from '@/pages/settings'
import { TeamPage } from '@/pages/team'
import { SetupPage } from '@/pages/setup'
import { SupportPage } from '@/pages/support'
import { appHome } from '@/lib/permissions'

function HomeRedirect() {
  const { profile, effectiveProfile, isImpersonating } = useAuth()
  const role = isImpersonating ? effectiveProfile?.role : profile?.role
  return <Navigate to={appHome(role)} replace />
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          <Route path="/account-suspended" element={<AccountSuspendedPage />} />

          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/invite/:token" element={<InvitePage />} />

          <Route element={<OnboardingRoute />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
          </Route>

          <Route element={<SetupRoute />}>
            <Route path="/setup" element={<SetupPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<NavAccessRoute />}>
            <Route path="/" element={<HomeRedirect />} />
            <Route
              path="/admin"
              element={
                <DashboardLayout>
                  <AdminOverviewPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/admin/organisations"
              element={
                <DashboardLayout>
                  <AdminOrganisationsPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/admin/organisations/:id"
              element={
                <DashboardLayout>
                  <AdminOrganisationDetailPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/admin/users"
              element={
                <DashboardLayout>
                  <AdminUsersPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/admin/voices"
              element={
                <DashboardLayout>
                  <AdminVoicesPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/admin/calls"
              element={
                <DashboardLayout>
                  <AdminCallsPage />
                </DashboardLayout>
              }
            />
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
              path="/schedule"
              element={
                <DashboardLayout>
                  <SchedulePage />
                </DashboardLayout>
              }
            />
            <Route
              path="/team"
              element={
                <DashboardLayout>
                  <TeamPage />
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
          <Route
            path="/forgot-password"
            element={<Navigate to="/login" replace />}
          />
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
        <Toaster richColors closeButton position="bottom-right" />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
