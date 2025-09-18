import React from 'react'
import AuthForm from './pages/AuthForm'
import { Routes, Route } from 'react-router-dom'

function App() {
  return (
    <>
    <Routes>
      <Route path='/' element={<AuthForm />} />
    </Routes>
    
    </>
  )
}

export default App
