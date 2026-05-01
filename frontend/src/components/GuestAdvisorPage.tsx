import AdvisorPage from "./pages/AdvisorPage";

interface GuestAdvisorPageProps {
  onLogout: () => void;
}

const GuestAdvisorPage: React.FC<GuestAdvisorPageProps> = ({ onLogout }) => {
  return (
    // SAME ROOT AS DASHBOARD (minus sidebar)
    <div className="min-h-screen bg-gray-100">
      <div className="flex h-screen bg-gray-50">
        
        {/* MAIN CONTENT (copied from DashboardLayout) */}
        <main className="flex-1 flex flex-col overflow-hidden">
          
          {/* TOP HEADER */}
          <header className="h-16 flex items-center justify-between px-6 bg-white border-b">
            <h2 className="text-xl font-semibold text-navy-800">
              AI Advisor
            </h2>

            <button
              onClick={onLogout}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Logout
            </button>
          </header>

          {/* PAGE CONTENT */}
          <div className="flex-1 overflow-hidden p-6">
            
            {/* CRITICAL HEIGHT + GRID CONTAINER */}
            <div className="h-[calc(100vh-4rem)]">
              <AdvisorPage />
            </div>

          </div>
        </main>
      </div>
    </div>
  );
};

export default GuestAdvisorPage;
