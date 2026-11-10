import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';

import '@fontsource/noto-serif-sc/500.css';
import '@fontsource/noto-serif-sc/600.css';
import '@fontsource/noto-serif-sc/700.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/jetbrains-mono/400.css';
import 'leaflet/dist/leaflet.css';
import './index.css';

import { WorkbenchProvider } from './store';
import { Shell } from './components/Shell';
import { ShowcaseHome } from './pages/ShowcaseHome';
import { Overview } from './pages/Overview';
import { ArchiveReader } from './pages/ArchiveReader';
import { Proofread } from './pages/Proofread';
import { Radar } from './pages/Radar';
import { Wiki } from './pages/Wiki';
import { Atlas } from './pages/Atlas';
import { Lab } from './pages/Lab';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorkbenchProvider>
      <BrowserRouter>
        <Routes>
          {/* Standalone MinerU / Transkribus Style Showcase Homepage */}
          <Route path="/" element={<ShowcaseHome />} />

          {/* Inner Research Workbench */}
          <Route
            path="/workbench"
            element={
              <Shell>
                <Overview />
              </Shell>
            }
          />
          <Route
            path="/library"
            element={
              <Shell>
                <Overview />
              </Shell>
            }
          />
          <Route
            path="/reader"
            element={
              <Shell>
                <ArchiveReader />
              </Shell>
            }
          />
          <Route
            path="/proofread"
            element={
              <Shell>
                <Proofread />
              </Shell>
            }
          />
          <Route
            path="/radar"
            element={
              <Shell>
                <Radar />
              </Shell>
            }
          />
          <Route
            path="/wiki"
            element={
              <Shell>
                <Wiki />
              </Shell>
            }
          />
          <Route
            path="/atlas"
            element={
              <Shell>
                <Atlas />
              </Shell>
            }
          />
          <Route
            path="/lab"
            element={
              <Shell>
                <Lab />
              </Shell>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        theme="light"
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#fffefb',
            border: '1px solid #dcd5c9',
            color: '#1f1b17',
            fontFamily: 'var(--font-sans)',
          },
        }}
      />
    </WorkbenchProvider>
  </StrictMode>
);
