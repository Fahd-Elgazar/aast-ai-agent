import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import {
  AdvisorRequestCoordinator,
  askAgent,
  getResponseConversationId,
} from '../../services/agentService';
import {
  HttpTimeoutError,
  isRequestCancellationError,
} from '../../services/httpClient';
import type { AgentDecisionResponse, RecommendationCardData } from '../../types';
import { extractVerifiedRecommendations } from '../utils/recommendationTruth';

interface VoiceRecorderProps {
  cid?: string | null;
  onCidChange?: (cid: string) => void;
  requestCoordinator?: AdvisorRequestCoordinator;
  disabled?: boolean;
  onResponseFetched: (
    reply: string,
    data: RecommendationCardData[],
    transcribedText?: string,
    response?: AgentDecisionResponse,
  ) => void;
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

function extractRecommendations(response: AgentDecisionResponse): RecommendationCardData[] {
  return extractVerifiedRecommendations(response);
}

export default function VoiceRecorder({
  cid,
  onCidChange,
  requestCoordinator,
  disabled = false,
  onResponseFetched,
  setLoading,
  setError,
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const internalCoordinatorRef = useRef(new AdvisorRequestCoordinator());
  const coordinator = requestCoordinator || internalCoordinatorRef.current;

  useEffect(() => () => {
    if (!requestCoordinator) internalCoordinatorRef.current.cancel();
  }, [requestCoordinator]);

  const submitTranscript = async (transcript: string) => {
    const activeCid = cid || null;
    const request = coordinator.begin(activeCid);
    setIsProcessing(true);
    setLoading(true);

    try {
      const response = (await askAgent(transcript, activeCid, {
        signal: request.controller.signal,
      })) as AgentDecisionResponse;
      if (!coordinator.isCurrent(request, cid || null)) return;

      const responseCid = getResponseConversationId(response, activeCid);
      if (responseCid && responseCid !== activeCid) onCidChange?.(responseCid);
      onResponseFetched(response.answer || "", extractRecommendations(response), transcript, response);
    } catch (err) {
      if (isRequestCancellationError(err)) return;
      if (!coordinator.isCurrent(request, cid || null)) return;
      console.error("Voice transcript orchestrator error:", err);
      setError(err instanceof HttpTimeoutError
        ? "The advisor did not respond before the request deadline."
        : "The advisor service could not process the voice transcript.");
    } finally {
      setIsProcessing(false);
      if (coordinator.finish(request)) setLoading(false);
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
      disabled={isProcessing || disabled}
      className={`flex items-center justify-center w-12 h-12 rounded-full transition-all focus:outline-none shrink-0 ${isRecording
        ? 'bg-red-500 hover:bg-red-600 animate-pulse ring-4 ring-red-100 shadow-lg text-white'
        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-sm'
        } ${isProcessing || disabled ? 'opacity-50 cursor-not-allowed bg-slate-200 shadow-none' : ''}`}
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
