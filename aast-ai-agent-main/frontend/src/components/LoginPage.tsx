import React, { useState } from 'react';
import type { User } from "../types";

interface LoginPageProps {
  onLogin: (user: User) => void;
  onGuestAccess: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onGuestAccess }) => {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (studentId && password) {
      onLogin({
        name: "Somaya Osama",
        major: "Computer Engineering",
        studentId,
        avatarUrl: "https://i.pravatar.cc/150?img=32"
      });
    }
  };

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden">

      {/* Left image panel — ALWAYS VISIBLE */}
      <div className="flex w-1/2 relative">
        <img 
          src="https://picsum.photos/1600/1200?grayscale" 
          alt="Campus" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-navy-900/40 mix-blend-multiply"></div>

        <div className="absolute bottom-16 left-12 text-white max-w-xl">
          <h1 className="text-5xl font-bold mb-4">Student Portal</h1>
          <p className="text-lg text-gray-200 leading-relaxed">
            The Student Portal is an online gateway where students can access courses, schedules, exam updates, and more.
          </p>
        </div>
      </div>

      {/* Right login panel */}
      <div className="w-1/2 flex flex-col justify-center px-12 bg-white overflow-y-auto">

        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-navy-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M12 14l9-5-9-5-9 5 9 5z"></path>
            </svg>
          </div>
          <span className="text-2xl font-bold text-navy-800">
            Student <span className="font-light">Portal</span>
          </span>
        </div>

        {/* Registration */}
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Registration</h2>
        <button className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded shadow-md">
          Open Registration
        </button>

        <div className="border-t border-gray-200 my-6"></div>

        {/* Login */}
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Login</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <input
            type="text"
            placeholder="Student ID (e.g. 221010803)"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="w-full bg-blue-50 border border-blue-100 text-gray-800 text-sm rounded-lg p-3.5"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-blue-50 border border-blue-100 text-gray-800 text-sm rounded-lg p-3.5"
          />

          <div className="border border-gray-300 p-3 rounded bg-gray-50 flex items-center justify-between">
            <div className="flex items-center">
              <input type="checkbox" className="w-4 h-4" />
              <label className="ml-2 text-sm text-gray-700">I'm not a robot</label>
            </div>
            <img src="https://www.gstatic.com/recaptcha/api2/logo_48.png" className="h-8 w-8 opacity-50" />
          </div>

          <div className="flex items-center">
            <input type="checkbox" className="w-4 h-4" />
            <label className="ml-2 text-sm text-gray-600">Remember Me</label>
          </div>

          <button 
            type="submit"
            className="w-full bg-navy-800 hover:bg-navy-900 text-white font-bold py-3 rounded-lg transition-all"
          >
            Login
          </button>
        </form>

        <p className="mt-4 text-xs text-gray-500 text-center">
          Can't log in or Forgot Password? Click <span className="text-blue-500 cursor-pointer">here</span>.
        </p>

        <div className="relative flex py-4 items-center">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="mx-4 text-gray-400 text-xs">New to Campus?</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>

        <button
          onClick={onGuestAccess}
          className="w-full bg-white border-2 border-gold-400 text-navy-800 hover:bg-gold-50 font-bold py-3 rounded-lg flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
          </svg>
          Prospective Student Chat
        </button>

      </div>
    </div>
  );
};

export default LoginPage;
