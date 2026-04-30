const HomePage = () => {
  return (
    <div className="space-y-6">
      <div className="p-6 bg-gradient-to-r from-navy-900 to-navy-700 rounded-xl text-white shadow">
        <h1 className="text-2xl font-bold">Welcome back, Somaya!</h1>
        <p className="text-sm mt-1">You have 2 upcoming assignments and 1 exam update.</p>
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
