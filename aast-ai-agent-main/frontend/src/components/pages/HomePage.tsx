import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  CreditCard,
  FileText,
  GraduationCap,
  HeartPulse,
  LifeBuoy,
  Sigma,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface HomePageProps {
  userName: string;
  onAskAdvisor: () => void;
}

interface ServiceItem {
  label: string;
  icon: LucideIcon;
}

const services: ServiceItem[] = [
  { label: "Student Results", icon: BarChart3 },
  { label: "Student Schedule", icon: CalendarDays },
  { label: "Transcript", icon: FileText },
  { label: "GPA Calculator", icon: Sigma },
  { label: "Clinic", icon: HeartPulse },
  { label: "E-Payment", icon: CreditCard },
  { label: "Moodle", icon: BookOpen },
  { label: "Support", icon: LifeBuoy },
];

const HomePage = ({ userName, onAskAdvisor }: HomePageProps) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-navy-900 bg-navy-950 text-white shadow-2xl shadow-navy-950/20">
        <div className="relative p-6 sm:p-8">
          <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.22),transparent_38%)]" />
          <div className="relative max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-gold-200 ring-1 ring-white/10">
              <GraduationCap className="h-4 w-4" aria-hidden="true" />
              Academic command center
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Welcome back, {userName}.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              You have 2 upcoming assignments and 1 exam update.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onAskAdvisor}
                className="inline-flex items-center gap-2 rounded-xl bg-gold-500 px-4 py-2.5 text-sm font-black text-navy-950 shadow-lg shadow-navy-950/20 transition hover:-translate-y-0.5 hover:bg-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-500/40"
              >
                <BrainCircuit className="h-4 w-4" aria-hidden="true" />
                Ask AI Advisor
              </button>
              <button
                type="button"
                onClick={() => navigate("/decision")}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                <GraduationCap className="h-4 w-4" aria-hidden="true" />
                Decision System
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {services.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              type="button"
              className="group flex min-h-28 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-navy-200 hover:shadow-xl hover:shadow-slate-900/10 focus:outline-none focus:ring-2 focus:ring-navy-500/20"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-800 transition group-hover:bg-navy-900 group-hover:text-gold-300">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-sm font-bold text-slate-900">{item.label}</span>
            </button>
          );
        })}
      </section>
    </div>
  );
};

export default HomePage;
