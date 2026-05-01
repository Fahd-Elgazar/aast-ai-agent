import { useNavigate } from "react-router-dom";

interface HomePageProps {
  userName: string;
  onAskAdvisor: () => void;
}

const HomePage = ({ userName, onAskAdvisor }: HomePageProps) => {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div className="p-6 bg-gradient-to-r from-navy-900 to-navy-700 rounded-xl text-white shadow">
        <h1 className="text-2xl font-bold">Welcome back, {userName}!</h1>
        <p className="text-sm mt-1">You have 2 upcoming assignments and 1 exam update.</p>
        <button
          type="button"
          onClick={onAskAdvisor}
          className="mt-4 rounded bg-gold-500 px-4 py-2 font-semibold text-navy-900"
        >
          Ask AI Advisor
        </button>
        <button
          onClick={() => navigate("/decision")}
          className="ml-3 mt-4 rounded bg-gold-500 px-4 py-2 font-semibold text-navy-900"
        >
          🧠 Decision System
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          "Student Results",
          "Student Schedule",
          "Transcript",
          "GPA Calculator",
          "Clinic",
          "E-Payment",
          "Moodle",
          "Support"
        ].map((item) => (
          <div key={item} className="p-4 bg-white rounded-lg shadow hover:shadow-md cursor-pointer">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HomePage;
