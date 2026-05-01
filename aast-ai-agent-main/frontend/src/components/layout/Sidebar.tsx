// Unused legacy router sidebar. The live student flow renders src/components/Dashboard.tsx.
import { NavLink } from "react-router-dom";

const Sidebar = () => {
  const user = {
    role: "student" // or "newcomer"
  };

  const menu = [
    { name: "Home", path: "/dashboard" },
    { name: "AI Academic Advisor", path: "/dashboard/advisor" },
    { name: "Courses", path: "/dashboard/courses" },
    { name: "Results", path: "/dashboard/results" }
  ];

  if (user.role === "newcomer") {
    return null; // 🔒 hide sidebar completely
  }

  return (
    <div className="w-64 bg-navy-900 text-white flex flex-col p-4">
      <nav className="flex flex-col gap-2">
        {menu.map((item) => (
          <NavLink key={item.path} to={item.path}>
            {item.name}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;
