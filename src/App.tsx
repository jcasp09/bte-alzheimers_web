import { NavLink, Route, Routes } from 'react-router-dom'
import clsx from 'clsx'
import { AuthProvider } from './contexts/AuthProvider'
import Home from './pages/Home'
import Graph from './pages/Graph'
import Profile from './pages/Profile'
import Tasks from './pages/Tasks'
import styles from './App.module.css'

function App() {
  return (
    <AuthProvider>
      <div className={styles.app}>
        <nav className={styles.tabs}>
          <NavLink
            to="/"
            end
            className={({ isActive }) => clsx(styles.tab, isActive && styles.tabActive)}
          >
            Home
          </NavLink>
          <NavLink
            to="/graph"
            className={({ isActive }) => clsx(styles.tab, isActive && styles.tabActive)}
          >
            Graph
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) => clsx(styles.tab, isActive && styles.tabActive)}
          >
            Profile
          </NavLink>
          <NavLink
            to="/tasks"
            className={({ isActive }) => clsx(styles.tab, isActive && styles.tabActive)}
          >
            Tasks
          </NavLink>
        </nav>

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
