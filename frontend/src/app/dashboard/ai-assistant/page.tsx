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
      text: 'Namaste! Welcome to your **HR AI Assistant**.\n\nHow can I assist you with HR operations today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedActions: ['Policy', 'Attendance', 'Leaves', 'Shift Timings']
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
    if (!selectedFile) {
      showToast?.('Please choose a PDF or DOC resume file first.', 'info');
      return;
    }
    setParsedData(null);
    setParseLoading(true);
    try {
      const formData = new FormData();
      formData.append('resume', selectedFile);
      formData.append('targetRole', targetRole);

      const res = await fetch('/ai-assistant-api/parse-resume', {
        method: 'POST',
        body: formData
      });
      const result = await res.json();
      if (res.ok && result.data) {
        setParsedData(result.data);
        showToast?.('Resume parsed and candidate profile extracted successfully!', 'success');
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
      {/* Page Header with Engine Dropdown */}
      <DashboardPageHeader
        title="AI Assistant & Operations Hub"
        subtitle="100% Free Lifetime HR AI Console powered by Local Open Source & Free Inference Models"
      >
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 px-1">Engine:</span>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
          >
            <option value="Ollama Local (DeepSeek/LLaMA)">Ollama Local (DeepSeek/LLaMA 3)</option>
            <option value="Hugging Face Open Source (BERT/Whisper)">Hugging Face Open Source (BERT/Whisper)</option>
            <option value="Google Gemini Free Tier API">Google Gemini Free Tier API</option>
          </select>
        </div>
      </DashboardPageHeader>

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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden flex flex-col h-[350px]">
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
              <p className="text-xs text-slate-500">Supports PDF, DOC, DOCX formats. Extracted automatically using AI.</p>
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
            <div className={`border-2 border-dashed ${selectedFile ? 'border-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/20' : 'border-indigo-300 dark:border-indigo-800/80 bg-indigo-50/30 dark:bg-indigo-950/20'} rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3 transition-colors`}>
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl">
                {selectedFile ? '📄' : '📁'}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {selectedFile ? selectedFile.name : 'Click or Drop candidate resume PDF here'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB • Ready to submit` : 'Maximum file size: 10 MB'}
                </p>
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
                {selectedFile ? 'Change Resume File' : 'Select Resume File'}
              </label>
            </div>

            <button
              onClick={handleParseResume}
              disabled={parseLoading}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl font-bold text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {parseLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Extracting & Screening Candidate Profile...</span>
                </>
              ) : (
                <>
                  <span>⚡ Parse Resume & Screen Match</span>
                </>
              )}
            </button>
          </div>

          {/* Parsed Result Display */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>AI Candidate Match Profile</span>
                  {parsedData && (
                    <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                      Parsed Live
                    </span>
                  )}
                </h3>
              </div>

              {/* 🔄 INSIDE AI LOADER STATE */}
              {parseLoading ? (
                <div className="py-10 flex flex-col items-center justify-center text-center space-y-5 animate-in fade-in">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border-2 border-indigo-500 flex items-center justify-center text-indigo-600 dark:text-indigo-400 animate-pulse">
                      <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    </div>
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-indigo-500 animate-ping" />
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      AI Resume Scanner in Progress
                    </h4>
                    <p className="text-xs text-slate-500 max-w-xs">
                      Extracting candidate Contact Info (Name, Email, Mobile), Skill Tags & Match Score...
                    </p>
                  </div>

                  {/* Simulated Shimmer Skeleton */}
                  <div className="w-full space-y-2.5 pt-2">
                    <div className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse w-full" />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-14 bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />
                      <div className="h-14 bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />
                    </div>
                  </div>
                </div>
              ) : parsedData ? (
                <div className="space-y-4 animate-in fade-in">
                  {/* Candidate Contact & Header Banner */}
                  <div className="p-4 bg-gradient-to-br from-indigo-50/80 via-purple-50/50 to-blue-50/80 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-blue-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-md">
                          {parsedData.candidateName ? parsedData.candidateName.charAt(0).toUpperCase() : 'C'}
                        </div>
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Candidate Name</span>
                          <h4 className="font-extrabold text-base text-slate-900 dark:text-white leading-tight">
                            {parsedData.candidateName}
                          </h4>
                          <p className="text-xs text-slate-500 font-medium">Applied for: {parsedData.targetRole}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-xs">
                        <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{parsedData.matchScore}</span>
                        <p className="text-[9px] font-black text-slate-500 uppercase">Match Score</p>
                      </div>
                    </div>

                    {/* Explicit Contact Details Cards: Email & Phone/Mobile */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-indigo-100/80 dark:border-indigo-900/40">
                      <div className="flex items-center gap-2 p-2 bg-white/90 dark:bg-slate-900/90 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                        <span className="text-sm">✉️</span>
                        <div className="overflow-hidden">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Email Address</span>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block" title={parsedData.email}>
                            {parsedData.email}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-2 bg-white/90 dark:bg-slate-900/90 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                        <span className="text-sm">📱</span>
                        <div className="overflow-hidden">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Mobile / Phone</span>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block" title={parsedData.phone || parsedData.mobile}>
                            {parsedData.phone || parsedData.mobile}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Experience & Verdict */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 font-bold block text-[10px] uppercase">Experience</span>
                      <span className="font-bold text-slate-900 dark:text-white">{parsedData.experienceYears}</span>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 font-bold block text-[10px] uppercase">AI Verdict</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{parsedData.recommendedVerdict}</span>
                    </div>
                  </div>

                  {/* Extracted Skills */}
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

                  {/* AI Summary */}
                  <div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">AI Executive Summary</span>
                    <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 leading-relaxed">
                      {parsedData.summary}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center text-slate-400 space-y-2">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl">
                    📄
                  </div>
                  <p className="text-xs font-medium text-slate-500 max-w-xs">
                    Upload a candidate resume PDF/DOC on the left and click submit to view extracted profile & contact details here.
                  </p>
                </div>
              )}
            </div>
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
