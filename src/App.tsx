import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthProvider'
import Header from './components/Header'
import Home from './pages/Home'
import Graph from './pages/Graph'
import Profile from './pages/Profile'
import Tasks from './pages/Tasks'
import styles from './App.module.css'

function App() {
  return (
    <AuthProvider>
      <div className={styles.app}>
        <Header />

        <main className={styles.tabContent}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/graph" element={<Graph />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/tasks" element={<Tasks />} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  )
}

export default App
