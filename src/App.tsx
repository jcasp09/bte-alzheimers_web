import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthProvider'
import Header from './components/Header'
import Home from './pages/Home'
import Graph from './pages/Graph'
import Moments from './pages/Moments'
import Profile from './pages/Profile'
import Tasks from './pages/Tasks'
import Settings from './pages/Settings'
import Appearance from './pages/Appearance'
import Accessibility from './pages/Accessibility'
import styles from './App.module.css'

function App() {
  const location = useLocation()
  const showHeader = location.pathname !== '/'

  return (
    <AuthProvider>
      <div className={styles.app}>
        {showHeader && <Header />}

        <main className={styles.main}>
          <div className={styles.mainInner}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/graph" element={<Graph />} />
              <Route path="/moments" element={<Moments />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/settings" element={<Settings />}>
                <Route index element={<Navigate to="account" replace />} />
                <Route path="account" element={<Profile />} />
                <Route path="appearance" element={<Appearance />} />
                <Route path="accessibility" element={<Accessibility />} />
              </Route>
            </Routes>
          </div>
        </main>
      </div>
    </AuthProvider>
  )
}

export default App
