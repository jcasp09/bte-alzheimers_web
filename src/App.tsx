import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { AuthProvider } from './contexts/AuthProvider'
import Header from './components/Header'
import Home from './pages/Home'
import Graph from './pages/Graph'
import Moments from './pages/Moments'
import Account from './pages/settings/Account'
import Tasks from './pages/Tasks'
import Settings from './pages/settings/Settings'
import Appearance from './pages/settings/Appearance'
import Accessibility from './pages/settings/Accessibility'
import Integrations from './pages/settings/Integrations'
import styles from './App.module.css'

function App() {
  const location = useLocation()
  const showHeader = location.pathname !== '/'
  const fullBleed = location.pathname === '/graph' || location.pathname === '/moments'

  return (
    <AuthProvider>
      <div className={styles.app}>
        {showHeader && <Header />}

        <main className={clsx(styles.main, fullBleed && styles.mainFullBleed)}>
          <div className={clsx(styles.mainInner, fullBleed && styles.mainInnerFullBleed)}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/graph" element={<Graph />} />
              <Route path="/moments" element={<Moments />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/settings" element={<Settings />}>
                <Route index element={<Navigate to="account" replace />} />
                <Route path="account" element={<Account />} />
                <Route path="appearance" element={<Appearance />} />
                <Route path="accessibility" element={<Accessibility />} />
                <Route path="integrations" element={<Integrations />} />
              </Route>
            </Routes>
          </div>
        </main>
      </div>
    </AuthProvider>
  )
}

export default App
