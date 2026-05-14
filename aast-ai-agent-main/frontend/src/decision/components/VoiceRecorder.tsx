import { useRef, useState } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { askAgent } from '../../services/agentService';

interface VoiceRecorderProps {
  cid?: string | null;
  onResponseFetched: (reply: string, data: any[], transcribedText?: string, response?: any) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechRecognitionEvent = Event & {
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionErrorEvent = Event & {
  error?: string;
};

function getSpeechRecognition(): SpeechRecognitionConstructor | undefined {
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
}

function decisionToRecommendation(decision: any) {
  const rawConf = decision?.confidence || 0;
  const conf = rawConf > 1 ? rawConf : rawConf * 100;

  return {
    program_name: decision?.recommended_major || "Recommended Program",
    college_name: decision?.college_name || "AAST Program",
    score: conf,
    match_type: decision?.match_type || "Recommended",
    confidence_level: conf >= 80 ? "High" : conf >= 50 ? "Medium" : "Low",
    estimated_semester_fee: decision?.estimated_semester_fee || 0,
    currency: decision?.currency || "USD",
    fee_mode: decision?.fee_mode || "Semester",
    affordability_label: decision?.affordability_label || "Match",
    score_breakdown: decision?.score_breakdown || {
      interest_alignment: decision?.confidence_breakdown?.interests_score || conf,
      affordability: 100,
      employment_outlook: decision?.confidence_breakdown?.market_score || 85,
      location_preference: 100,
      career_flexibility: 90,
      certificate_compatibility: decision?.confidence_breakdown?.grades_score || 100,
      decision_data_completeness: 100,
      missing_data_penalty: 0
    },
    warnings: decision?.warnings || (decision?.reason ? [decision.reason] : [])
  };
}

function extractRecommendations(response: any) {
  if (Array.isArray(response?.recommendations)) return response.recommendations;
  if (response?.decision) return [decisionToRecommendation(response.decision)];
  return [];
}

export default function VoiceRecorder({ cid, onResponseFetched, setLoading, setError }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  const submitTranscript = async (transcript: string) => {
    setIsProcessing(true);
    setLoading(true);

    try {
      const response = await askAgent(transcript, cid);
      onResponseFetched(response.answer || "", extractRecommendations(response), transcript, response);
    } catch (err) {
      console.error("Voice transcript orchestrator error:", err);
      setError("Failed to process voice transcript through the orchestrator.");
    } finally {
      setIsProcessing(false);
      setLoading(false);
    }
  };

  const startRecording = () => {
    setError(null);

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setError("Voice input is not supported by this browser. Please type your message instead.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();

      if (!transcript) {
        setError("No speech was detected. Please try again.");
        return;
      }

      void submitTranscript(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error || "unknown");
      setError("Voice recognition failed. Please try again or type your message.");
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  return (
    <button
      onClick={isRecording ? stopRecording : startRecording}
      disabled={isProcessing}
      className={`flex items-center justify-center w-12 h-12 rounded-full transition-all focus:outline-none shrink-0 ${isRecording
        ? 'bg-red-500 hover:bg-red-600 animate-pulse ring-4 ring-red-100 shadow-lg text-white'
        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-sm'
        } ${isProcessing ? 'opacity-50 cursor-not-allowed bg-slate-200 shadow-none' : ''}`}
      title={isProcessing ? "Processing audio..." : isRecording ? "Stop recording" : "Record your preference"}
    >
      {isProcessing ? (
        <Loader2 className="animate-spin text-slate-500" size={20} />
      ) : isRecording ? (
        <Square className="text-white" fill="currentColor" size={18} />
      ) : (
        <Mic size={20} />
      )}
    </button>
  );
}
