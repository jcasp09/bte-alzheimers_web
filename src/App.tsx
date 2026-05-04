import { Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthProvider'
import Header from './components/Header'
import Home from './pages/Home'
import Graph from './pages/Graph'
import Profile from './pages/Profile'
import Tasks from './pages/Tasks'
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
              <Route path="/profile" element={<Profile />} />
              <Route path="/tasks" element={<Tasks />} />
            </Routes>
          </div>
        </main>
      </div>
    </AuthProvider>
  )
}

export default App
