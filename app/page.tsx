import React from 'react'
import Sidebar from './components/sidebar'
import Navbar from './components/navbar'
import Contractordashboard from './pages/contractorpages/dashboard/page'
import ContractorRoute from './components/contractor-route'

const page = () => {
  return (
    <ContractorRoute>
    <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <Navbar />
            <main className="min-h-0 flex-1 overflow-y-auto p-6">
                <Contractordashboard />
            </main>
        </div>
    </div>
    </ContractorRoute>
  )
}
       
export default page