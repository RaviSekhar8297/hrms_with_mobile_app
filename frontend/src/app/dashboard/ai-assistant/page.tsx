'use client';

import React, { useState, useRef, useEffect } from 'react';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { useDashboard } from '../components/DashboardContext';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  suggestedActions?: string[];
}

export default function AiAssistantPage() {
  const { showToast } = useDashboard();
  const [activeTab, setActiveTab] = useState<'chat' | 'resume' | 'insights'>('chat');
  const [selectedModel, setSelectedModel] = useState<string>('Ollama Local (DeepSeek/LLaMA)');

  // Chat Tab State
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: 'Namaste! Welcome to your **100% Free Lifetime HR AI Console**.\n\nI am configured to run locally or via free tier open-source inference models. How can I assist you with HR operations today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedActions: [
        'How many casual leaves are allowed per year?',
        'What are the permission & late arrival rules?',
        'How does salary overtime calculation work?',
        'Parse Candidate Resume'
      ]
    }
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab]);

  const handleSendChat = async (overrideText?: string) => {
    const q = overrideText || chatInput;
    if (!q.trim() || chatLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!overrideText) setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch('/ai-assistant-api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, model: selectedModel })
      });
      const data = await res.json();
      if (res.ok && data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: 'ai',
            text: data.reply,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            suggestedActions: data.suggestedActions
          }
        ]);
      } else {
        throw new Error(data.error || 'Failed to fetch AI reply');
      }
    } catch (err: any) {
      showToast?.(err.message || 'AI Chat error', 'error');
    } finally {
      setChatLoading(false);
    }
  };

  // Resume Parsing Tab State
  const [targetRole, setTargetRole] = useState('Senior Fullstack Developer');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseLoading, setParseLoading] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);

  const handleParseResume = async () => {
    setParseLoading(true);
    try {
      const formData = new FormData();
      if (selectedFile) formData.append('resume', selectedFile);
      formData.append('targetRole', targetRole);

      const res = await fetch('/ai-assistant-api/parse-resume', {
        method: 'POST',
        body: formData
      });
      const result = await res.json();
      if (res.ok && result.data) {
        setParsedData(result.data);
        showToast?.('Resume parsed successfully with 100% Free Local AI!', 'success');
      } else {
        throw new Error(result.error || 'Resume parsing failed');
      }
    } catch (err: any) {
      showToast?.(err.message || 'Failed to parse resume', 'error');
    } finally {
      setParseLoading(false);
    }
  };

  // Mock Anomaly Insights Data
  const anomalyInsights = [
    {
      id: 1,
      title: 'Late Punch-in Frequency Alert',
      severity: 'medium',
      metric: '14 Employees',
      description: '14 employees logged late entries more than 3 times this week. Recommendation: Send automated reminder for permission requests.',
      badge: 'Attendance Risk'
    },
    {
      id: 2,
      title: 'Optimal Shift Allocation Recommendation',
      severity: 'low',
      metric: 'Engineering Dept',
      description: 'Core peak hours for Engineering are between 11 AM - 4 PM. AI suggests enabling flexi-hours to boost attendance adherence by 18%.',
      badge: 'Optimization'
    },
    {
      id: 3,
      title: 'Overtime Budget Warning',
      severity: 'high',
      metric: '42 Overtime Hours',
      description: 'Operations team accrued 42 hours of OT this fortnight. Review shift swapping to balance workload.',
      badge: 'Payroll Anomaly'
    }
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <DashboardPageHeader
        title="AI Assistant & Operations Hub"
        subtitle="100% Free Lifetime HR AI Console powered by Local Open Source & Free Inference Models"
      />

      {/* Model Indicator & Capability Banner */}
      <div className="p-4 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white border border-indigo-400/30 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-white font-black text-xl shadow-inner">
            🤖
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base">Active AI Engine</h2>
              <span className="bg-white/20 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-white/30">
                100% Lifetime Free
              </span>
            </div>
            <p className="text-xs text-blue-100">
              No API subscriptions required. Powered by local Ollama & Hugging Face models.
            </p>
          </div>
        </div>

        {/* Model Switcher */}
        <div className="flex items-center gap-2 bg-white/15 p-1.5 rounded-2xl border border-white/25 backdrop-blur-md">
          <span className="text-xs font-semibold px-2 text-blue-100">Engine:</span>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white border border-white/30 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer shadow-xs"
          >
            <option value="Ollama Local (DeepSeek/LLaMA)">Ollama Local (DeepSeek/LLaMA 3)</option>
            <option value="Hugging Face Open Source (BERT/Whisper)">Hugging Face Open Source (BERT/Whisper)</option>
            <option value="Google Gemini Free Tier API">Google Gemini Free Tier API</option>
          </select>
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-fit">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'chat'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>💬 HR AI Agent Chat</span>
        </button>
        <button
          onClick={() => setActiveTab('resume')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'resume'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>📄 Smart Resume Parser</span>
        </button>
        <button
          onClick={() => setActiveTab('insights')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'insights'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>📊 Anomaly & Policy Insights</span>
        </button>
      </div>

      {/* TAB 1: AI HR AGENT CHAT */}
      {activeTab === 'chat' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden flex flex-col h-[460px]">
          {/* Chat Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Interactive Assistant Session
              </span>
            </div>
            <button
              onClick={() => setMessages([messages[0]])}
              className="text-xs text-slate-500 hover:text-red-500 transition-colors font-medium cursor-pointer"
            >
              Clear Conversation
            </button>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/30 dark:bg-slate-900/30">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[75%] p-4 rounded-3xl text-xs leading-relaxed shadow-xs ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-none'
                  }`}
                >
                  <div className="whitespace-pre-line font-normal">{msg.text}</div>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-2">{msg.timestamp}</span>

                {/* Suggested Action Chips */}
                {msg.suggestedActions && (
                  <div className="flex flex-wrap gap-2 mt-2 max-w-[80%]">
                    {msg.suggestedActions.map((action, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendChat(action)}
                        className="text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/80 px-3 py-1.5 rounded-xl hover:bg-indigo-600 hover:text-white transition-all cursor-pointer font-semibold shadow-xs"
                      >
                        ⚡ {action}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {chatLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-400 italic bg-white dark:bg-slate-800 p-3 rounded-2xl w-fit border border-slate-200 dark:border-slate-700 shadow-xs">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                <span>Processing query via local AI engine...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Box */}
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder="Ask anything about Leave rules, Permission limits, Payslips, Attendance..."
              className="flex-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <button
              onClick={() => handleSendChat()}
              disabled={chatLoading || !chatInput.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-3 rounded-2xl font-bold text-xs transition-all shadow-md cursor-pointer flex items-center gap-2"
            >
              <span>Send Query</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: SMART RESUME PARSER */}
      {activeTab === 'resume' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Resume Upload Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Upload Candidate Resume</h3>
              <p className="text-xs text-slate-500">Supports PDF, DOCX formats. Extracted automatically using open-source AI.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Target Job Role</label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g. Senior Fullstack Developer, HR Manager"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Drag & Drop File Zone */}
            <div className="border-2 border-dashed border-indigo-300 dark:border-indigo-800/80 bg-indigo-50/30 dark:bg-indigo-950/20 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                📄
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {selectedFile ? selectedFile.name : 'Click or Drop candidate resume PDF here'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Maximum file size: 10 MB</p>
              </div>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
                id="resume-upload-input"
              />
              <label
                htmlFor="resume-upload-input"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                Select Resume File
              </label>
            </div>

            <button
              onClick={handleParseResume}
              disabled={parseLoading}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl font-bold text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              {parseLoading ? 'Extracting Resume Data with AI...' : 'Parse Resume & Screen Match'}
            </button>
          </div>

          {/* Parsed Result Display */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-3">
              AI Candidate Match Profile
            </h3>

            {parsedData ? (
              <div className="space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl">
                  <div>
                    <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-200">{parsedData.candidateName}</h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">{parsedData.email} • {parsedData.phone}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{parsedData.matchScore}</span>
                    <p className="text-[10px] font-bold text-emerald-700 uppercase">Match Score</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">Experience</span>
                    <span className="font-bold text-slate-900 dark:text-white">{parsedData.experienceYears}</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">Verdict</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{parsedData.recommendedVerdict}</span>
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">Extracted Skill Tags</span>
                  <div className="flex flex-wrap gap-1.5">
                    {parsedData.extractedSkills.map((skill: string, i: number) => (
                      <span key={i} className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-semibold">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">AI Executive Summary</span>
                  <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 leading-relaxed">
                    {parsedData.summary}
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center text-slate-400 space-y-2">
                <span className="text-4xl">📄</span>
                <p className="text-xs font-medium">Upload a candidate resume on the left to view parsed AI breakdown here.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ANOMALY & POLICY INSIGHTS */}
      {activeTab === 'insights' && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">AI Policy & Attendance Monitor</h3>
              <p className="text-xs text-slate-500">Real-time proactive suggestions to optimize workplace rules & attendance</p>
            </div>
            <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase rounded-full border border-indigo-200 dark:border-indigo-800">
              Live Monitoring
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {anomalyInsights.map((insight) => (
              <div
                key={insight.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-lg space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {insight.badge}
                    </span>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{insight.metric}</span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{insight.title}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                    {insight.description}
                  </p>
                </div>

                <button
                  onClick={() => showToast?.(`AI Action dispatched for: ${insight.title}`, 'info')}
                  className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer mt-3"
                >
                  Apply AI Recommendation
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
