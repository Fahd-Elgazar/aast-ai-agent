import { useState, useRef, useEffect } from 'react';
import CollegeCard from '../components/CollegeCard';
import VoiceRecorder from '../components/VoiceRecorder';
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
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

const SUGGESTED_PROMPTS = [
  "Recommend the best AI specialization",
  "Compare AI vs Cybersecurity",
  "Which major fits my GPA?",
  "Career roadmap for NLP engineer"
];

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  recommendations?: RecommendationCardData[];
};

function extractRecommendations(response: AgentDecisionResponse): RecommendationCardData[] {
  return extractVerifiedRecommendations(response);
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'assistant',
      content: "Hello! I'm your AAST AI Agent. Tell me about what you'd like to study, your budget, or your certificate background, and I'll find the perfect program for you."
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [cid, setCid] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const cidRef = useRef<string | null>(null);
  const requestCoordinatorRef = useRef(new AdvisorRequestCoordinator());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => () => {
    requestCoordinatorRef.current.cancel();
  }, []);

  const adoptCid = (nextCid: string) => {
    cidRef.current = nextCid;
    setCid(nextCid);
  };

  const handleSend = async (overrideInput?: string) => {
    const textToSend = typeof overrideInput === 'string' ? overrideInput : input;
    if (!textToSend.trim() || isTyping) return;

    const activeCid = cidRef.current;
    const request = requestCoordinatorRef.current.begin(activeCid);

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: textToSend };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const response = (await askAgent(textToSend, activeCid, {
        signal: request.controller.signal,
      })) as AgentDecisionResponse;
      if (!requestCoordinatorRef.current.isCurrent(request, cidRef.current)) return;

      const responseCid = getResponseConversationId(response, activeCid);
      if (responseCid && responseCid !== activeCid) adoptCid(responseCid);

      const replyMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer || "I could not generate a response.",
        recommendations: extractRecommendations(response)
      };

      setMessages(prev => [...prev, replyMsg]);
    } catch (err) {
      if (isRequestCancellationError(err)) return;
      if (!requestCoordinatorRef.current.isCurrent(request, cidRef.current)) return;
      console.error("Orchestrator chat error:", err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: err instanceof HttpTimeoutError
          ? "The advisor did not respond before the request deadline. Please try again."
          : "The advisor service could not complete this request. Please try again."
      }]);
    } finally {
      if (requestCoordinatorRef.current.finish(request)) setIsTyping(false);
    }
  };

  const isInitialState = messages.length === 1 && messages[0].id === 'init';

  return (
    <div className="h-full w-full min-h-0 bg-slate-50 flex flex-col relative">
      <div className="flex-1 min-h-0 overflow-y-auto w-full p-4 md:p-8">
        <div className="max-w-4xl mx-auto flex flex-col gap-6 pb-6">

          {isInitialState ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center px-4 mt-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-aast-navy to-slate-800 text-aast-gold flex items-center justify-center shadow-2xl mb-6 relative">
                <Bot size={32} />
                <Sparkles size={16} className="absolute -top-2 -right-2 text-gold-400 animate-pulse" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 tracking-tight">
                UniPortal AI Assistant
              </h1>
              <p className="text-slate-500 max-w-md mx-auto mb-10 leading-relaxed text-base">
                {messages[0].content}
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                {SUGGESTED_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(prompt)}
                    className="flex text-left p-4 rounded-xl border border-slate-200/60 bg-white shadow-sm hover:shadow-md hover:border-aast-navy/30 transition-all duration-200 group items-start gap-3"
                  >
                    <div className="mt-0.5 text-slate-400 group-hover:text-aast-navy transition-colors">
                      <Sparkles size={18} />
                    </div>
                    <span className="text-sm text-slate-600 group-hover:text-slate-900 font-medium leading-snug">
                      {prompt}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className="flex gap-4 md:gap-6 w-full group">
                  <div className="shrink-0 mt-1">
                    {msg.role === 'assistant' ? (
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-aast-navy text-aast-gold flex items-center justify-center shadow-sm">
                        <Bot size={20} />
                      </div>
                    ) : (
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-slate-200 text-slate-500 flex items-center justify-center shadow-sm">
                        <User size={20} />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col gap-2 pt-1">
                    <div className="font-semibold text-sm text-slate-900">
                      {msg.role === 'assistant' ? 'AAST AI Agent' : 'You'}
                    </div>
                    
                    <div className="leading-relaxed text-[15px] text-slate-800 whitespace-pre-wrap break-words">
                      {msg.content}
                    </div>

                    {msg.recommendations && msg.recommendations.length > 0 && (
                      <div className="flex flex-wrap gap-4 mt-3 w-full">
                        {msg.recommendations.map((rec, idx) => (
                          <div key={idx} className="w-[340px] max-w-full">
                            <CollegeCard
                              programName={rec.program_name}
                              collegeName={rec.college_name}
                              matchScore={rec.score}
                              matchType={rec.match_type}
                              confidence={rec.confidence_level}
                              fee={rec.estimated_semester_fee}
                              currency={rec.currency}
                              feeMode={rec.fee_mode}
                              affordability={rec.affordability_label}
                              scoreBreakdown={rec.score_breakdown}
                              warnings={rec.warnings || []}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-4 md:gap-6 w-full group">
                  <div className="shrink-0 mt-1">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-aast-navy text-aast-gold flex items-center justify-center shadow-sm">
                      <Bot size={20} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-2 pt-1">
                    <div className="font-semibold text-sm text-slate-900">AAST AI Agent</div>
                    <div className="flex items-center gap-2 text-slate-500 mt-1">
                      <Loader2 className="animate-spin text-aast-navy" size={18} />
                      <span className="text-sm font-medium">Agent is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="flex-none p-4 md:px-8 md:pb-8 md:pt-4 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent">
        <div className="max-w-3xl mx-auto flex gap-3 relative items-center bg-white p-2 rounded-full shadow-lg border border-slate-200/60 focus-within:ring-2 focus-within:ring-aast-navy/20 focus-within:border-aast-navy transition-all">
          <VoiceRecorder
            cid={cid}
            onCidChange={adoptCid}
            requestCoordinator={requestCoordinatorRef.current}
            disabled={isTyping}
            onResponseFetched={(reply, recs, transcribedText) => {
              const newMessages: Message[] = [];
              if (transcribedText) {
                newMessages.push({
                  id: Date.now().toString() + "_user",
                  role: 'user',
                  content: transcribedText
                });
              }
              newMessages.push({
                id: Date.now().toString() + "_assistant",
                role: 'assistant',
                content: reply || 'I analyzed your voice input.',
                recommendations: recs
              });
              setMessages(prev => [...prev, ...newMessages]);
              setInput("");
              scrollToBottom();
            }}
            setLoading={setIsTyping}
            setError={(errStr) => {
              if (errStr) {
                setMessages(prev => [...prev, {
                  id: Date.now().toString(),
                  role: 'assistant',
                  content: `Error: ${errStr}`
                }]);
              }
            }}
          />
          <div className="flex-1 relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="w-full bg-transparent border-none outline-none pl-4 pr-14 py-3 text-slate-800 placeholder:text-slate-400 text-[15px]"
              placeholder="Ask anything about majors, careers, or universities..."
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className="absolute right-1 top-1 bottom-1 aspect-square bg-aast-navy text-white rounded-full flex items-center justify-center hover:bg-aast-blue transition-colors disabled:opacity-50 disabled:hover:bg-aast-navy"
            >
              <Send size={18} className="translate-x-0.5" />
            </button>
          </div>
        </div>
        <p className="text-center text-[11px] text-slate-400 mt-4 font-medium px-4">
          AAST AI Agent can dynamically filter recommendations based on your chat context. Information provided is for guidance purposes.
        </p>
      </div>
    </div>
  );
}
