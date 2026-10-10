import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DashboardPage } from './pages/DashboardPage.tsx'
import { DualPage } from './pages/DualPage.tsx'
import { EditorPage } from './pages/EditorPage.tsx'
import { ExercisePage } from './pages/ExercisePage.tsx'
import { GhostPage } from './pages/GhostPage.tsx'
import { IkPage } from './pages/IkPage.tsx'
import { ManualPage } from './pages/ManualPage.tsx'
import { BuilderPage } from './pages/product/BuilderPage.tsx'
import { ClinicianHome, PatientPage } from './pages/product/ClinicianPages.tsx'
import { ExerciseDetailPage } from './pages/product/ExerciseDetailPage.tsx'
import { ExercisesPage } from './pages/product/ExercisesPage.tsx'
import { HomeDash } from './pages/product/HomeDash.tsx'
import { LiveSessionPage } from './pages/product/LiveSessionPage.tsx'
import { ProgressPage } from './pages/product/ProgressPage.tsx'
import { ResultsPage } from './pages/product/ResultsPage.tsx'
import { ReviewPage } from './pages/product/ReviewPage.tsx'
import { DevicesPage, DevLabPage, SettingsPage } from './pages/product/SettingsPages.tsx'
import { ResearcherPage } from './pages/product/ResearcherPage.tsx'
import { SetupPage } from './pages/product/SetupPage.tsx'
import { StudyOverviewPage } from './pages/product/StudyOverviewPage.tsx'
import { ReplayPage } from './pages/ReplayPage.tsx'
import { SensorPage } from './pages/SensorPage.tsx'
import { TrailPage } from './pages/TrailPage.tsx'
import { ViewerPage } from './pages/ViewerPage.tsx'
import { Shell } from './ui/Shell.tsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<HomeDash />} />
          <Route path="session" element={<Navigate to="/session/setup" replace />} />
          <Route path="session/setup" element={<SetupPage />} />
          <Route path="session/live" element={<LiveSessionPage />} />
          <Route path="session/results" element={<ResultsPage />} />
          <Route path="exercises" element={<ExercisesPage />} />
          <Route path="exercises/:exerciseId" element={<ExerciseDetailPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="progress/session/:sessionId" element={<ReviewPage />} />
          <Route path="clinician" element={<ClinicianHome />} />
          <Route path="clinician/patients" element={<Navigate to="/clinician" replace />} />
          <Route path="clinician/patient/:id" element={<PatientPage />} />
          <Route path="clinician/builder" element={<BuilderPage />} />
          <Route path="study" element={<StudyOverviewPage />} />
          <Route path="study/participant/:id" element={<ResearcherPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/devices" element={<DevicesPage />} />
          <Route path="dev" element={<DevLabPage />} />
          <Route path="dev/viewer" element={<ViewerPage />} />
          <Route path="dev/manual" element={<ManualPage />} />
          <Route path="dev/ik" element={<IkPage />} />
          <Route path="dev/sensor" element={<SensorPage />} />
          <Route path="dev/exercise" element={<ExercisePage />} />
          <Route path="dev/replay" element={<ReplayPage />} />
          <Route path="dev/ghost" element={<GhostPage />} />
          <Route path="dev/dual" element={<DualPage />} />
          <Route path="dev/trails" element={<TrailPage />} />
          <Route path="dev/scoring" element={<DashboardPage />} />
          <Route path="dev/editor" element={<EditorPage />} />
          <Route path="viewer" element={<Navigate to="/dev/viewer" replace />} />
          <Route path="manual" element={<Navigate to="/dev/manual" replace />} />
          <Route path="ik" element={<Navigate to="/dev/ik" replace />} />
          <Route path="sensor" element={<Navigate to="/dev/sensor" replace />} />
          <Route path="exercise" element={<Navigate to="/dev/exercise" replace />} />
          <Route path="replay" element={<Navigate to="/dev/replay" replace />} />
          <Route path="ghost" element={<Navigate to="/dev/ghost" replace />} />
          <Route path="dual" element={<Navigate to="/dev/dual" replace />} />
          <Route path="trails" element={<Navigate to="/dev/trails" replace />} />
          <Route path="dashboard" element={<Navigate to="/dev/scoring" replace />} />
          <Route path="editor" element={<Navigate to="/dev/editor" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
