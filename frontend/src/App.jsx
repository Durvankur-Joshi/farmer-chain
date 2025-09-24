import React from 'react'
import AuthForm from './pages/AuthForm'
import AdminDashboard from './pages/AdminDashboard'
import AdminLogin from './pages/AdminLogin'
import { Routes, Route } from 'react-router-dom'

function App() {
  return (
    <>
    <Routes>
      <Route path='/' element={<AuthForm />} />
      <Route path='/admin' element={<AdminLogin />} />
      <Route path='/admin/dashboard' element={<AdminDashboard />} />
    </Routes>
    
    </>
  )
}

export default App
