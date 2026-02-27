import { NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import Home from './pages/Home'
import Graph from './pages/Graph'
import Profile from './pages/Profile'

function App() {
  return (
    <div className="app">
      <nav className="tabs">
        <NavLink
          to="/"
          end
          className={({ isActive }) => (isActive ? 'tab tab-active' : 'tab')}
        >
          Home
        </NavLink>
        <NavLink
          to="/graph"
          className={({ isActive }) => (isActive ? 'tab tab-active' : 'tab')}
        >
          Graph
        </NavLink>
        <NavLink
          to="/profile"
          className={({ isActive }) => (isActive ? 'tab tab-active' : 'tab')}
        >
          Profile
        </NavLink>
      </nav>

      <main className="tab-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/graph" element={<Graph />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
