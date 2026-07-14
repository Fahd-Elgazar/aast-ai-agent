import { useStudent, type CertificateType } from '../../decision/context/StudentContext';

const CERTIFICATE_TYPES: CertificateType[] = [
  "Egyptian Thanaweya Amma (Science)",
  "Egyptian Thanaweya Amma (Math)",
  "Egyptian Thanaweya Amma (Literature)",
  "IGCSE",
  "American Diploma",
  "Other"
];

interface UIInterest {
  label: string;
  backendValue: string;
}

interface InterestGroup {
  category: string;
  items: UIInterest[];
}

const INTEREST_GROUPS: InterestGroup[] = [
  {
    category: "Computing & AI",
    items: [
      { label: "Artificial Intelligence", backendValue: "artificial intelligence" },
      { label: "Data Science", backendValue: "data science" },
      { label: "Computer Science", backendValue: "computer science" },
      { label: "Programming", backendValue: "programming" },
      { label: "Cybersecurity", backendValue: "cybersecurity" },
      { label: "Information Systems", backendValue: "information systems" }
    ]
  },
  {
    category: "Engineering & Tech",
    items: [
      { label: "Architecture", backendValue: "architecture" },
      { label: "Mechanical Engineering", backendValue: "mechanical" },
      { label: "Electrical Engineering", backendValue: "electrical" },
      { label: "Electronics", backendValue: "electronics" },
      { label: "Computer Engineering", backendValue: "computer engineering" },
      { label: "Robotics", backendValue: "robotics engineering" },
      { label: "Embedded Systems", backendValue: "embedded systems engineering" }
    ]
  },
  {
    category: "Business",
    items: [
      { label: "Business Administration", backendValue: "business" },
      { label: "Management", backendValue: "management" },
      { label: "Finance", backendValue: "finance" },
      { label: "Marketing", backendValue: "marketing" },
      { label: "Economics", backendValue: "economics" }
    ]
  },
  {
    category: "Maritime & Logistics",
    items: [
      { label: "Logistics", backendValue: "logistics" },
      { label: "Supply Chain", backendValue: "supply chain" },
      { label: "Transport Operations", backendValue: "transport" },
      { label: "Maritime Studies", backendValue: "maritime" }
    ]
  },
  {
    category: "Healthcare",
    items: [
      { label: "Medicine", backendValue: "medicine" },
      { label: "Pharmacy", backendValue: "pharmacy" },
      { label: "Dentistry", backendValue: "dentistry" }
    ]
  },
  {
    category: "Law & Humanities",
    items: [
      { label: "Law", backendValue: "law" },
      { label: "Media & Journalism", backendValue: "media" },
      { label: "Translation Studies", backendValue: "translation" },
      { label: "Graphic Design", backendValue: "graphic" },
      { label: "Art & Creative", backendValue: "art" }
    ]
  }
];

export default function DecisionForm() {
  const { profile, updateProfile } = useStudent();

  const handleInterestToggle = (backendValue: string) => {
    const current = new Set(profile.interests);
    if (current.has(backendValue)) {
      current.delete(backendValue);
    } else {
      current.add(backendValue);
    }
    updateProfile({ interests: Array.from(current) });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Budget */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Max Semester Budget (USD)
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="0" max="20000" step="500"
            value={profile.budget || 0}
            onChange={e => updateProfile({ budget: Number(e.target.value) || null })}
            className="flex-1 accent-aast-navy"
          />
          <span className="text-sm font-semibold text-aast-navy w-16 text-right font-mono">
            {profile.budget ? `$${profile.budget}` : 'Any'}
          </span>
        </div>
      </div>

      {/* Certificate Type */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Certificate</label>
        <select
          className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-md p-2 text-sm focus:ring-aast-navy focus:border-aast-navy focus:outline-none focus:ring-2 focus:ring-[rgb(20,41,82)]/30 outline-none"
          value={profile.certificate_type}
          onChange={e => updateProfile({ certificate_type: e.target.value as CertificateType | "" })}
        >
          <option value="">Select Certificate</option>
          {CERTIFICATE_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* High School Percentage */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Grade Percentage</label>
        <input
          type="number" min="0" max="100" step="0.1"
          placeholder="e.g. 85.5"
          value={profile.high_school_percentage || ''}
          onChange={e => updateProfile({ high_school_percentage: parseFloat(e.target.value) || null })}
          className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-md p-2 text-sm focus:ring-aast-navy focus:border-aast-navy focus:outline-none focus:ring-2 focus:ring-[rgb(20,41,82)]/30 outline-none"
        />
      </div>

      {/* Preferred Campus */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Campus / Branch</label>
        <select
          className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-md p-2 text-sm focus:ring-aast-navy focus:border-aast-navy focus:outline-none focus:ring-2 focus:ring-[rgb(20,41,82)]/30 outline-none"
          value={profile.preferred_branch}
          onChange={e => updateProfile({ preferred_branch: e.target.value })}
        >
          <option value="">Any Campus</option>
          <option value="abu qir">Abu Qir (Alexandria)</option>
          <option value="miami">Miami (Alexandria)</option>
          <option value="heliopolis">Heliopolis (Cairo)</option>
          <option value="dokki">Dokki (Giza)</option>
          <option value="smart village">Smart Village (Giza)</option>
          <option value="el alamein">El Alamein</option>
          <option value="port said">Port Said</option>
          <option value="south valley">South Valley (Aswan)</option>
          <option value="latakia">Latakia (Syria)</option>
        </select>
      </div>

      {/* Interests */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Interests</label>
        <div className="max-h-[260px] overflow-y-auto p-2 border border-slate-200 rounded-lg bg-slate-50/50 flex flex-col gap-4">
          {INTEREST_GROUPS.map(group => (
            <div key={group.category} className="space-y-1.5">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">
                {group.category}
              </h4>
              <div className="flex flex-wrap gap-2">
                {group.items.map(interest => {
                  const isSelected = profile.interests.includes(interest.backendValue);
                  return (
                    <button
                      key={interest.backendValue}
                      onClick={() => handleInterestToggle(interest.backendValue)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-full border transition-all flex items-center gap-1 cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(20,41,82)] focus-visible:outline-none focus:outline-none ${
                        isSelected
                          ? 'bg-[rgb(20,41,82)] text-white border-[rgb(20,41,82)] shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300 hover:text-slate-900'
                      }`}
                    >
                      {isSelected && <span className="font-bold text-[10px]">✓</span>}
                      {interest.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Student Group Toggle */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Student Group</label>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            className={`flex-1 py-1 text-sm font-medium rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-[rgb(20,41,82)] focus-visible:outline-none ${
              profile.student_group === 'supportive_states' ? 'bg-white shadow text-aast-navy' : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => updateProfile({ student_group: 'supportive_states' })}
          >
            Supportive States
          </button>
          <button
            className={`flex-1 py-1 text-sm font-medium rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-[rgb(20,41,82)] focus-visible:outline-none ${
              profile.student_group === 'other_states' ? 'bg-white shadow text-aast-navy' : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => updateProfile({ student_group: 'other_states' })}
          >
            Other States
          </button>
        </div>
      </div>
    </div>
  );
}
