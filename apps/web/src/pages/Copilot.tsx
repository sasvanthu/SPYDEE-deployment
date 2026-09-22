import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect } from 'react';
import { api } from '../lib/api';
import { Terminal, Send, Sparkles, AlertTriangle, ArrowRight, CornerDownLeft, Shield, Cpu, Settings, X, Check, Trash2, ExternalLink } from 'lucide-react';
import { useTerminalAlert } from '../context/TerminalAlertContext';
import { getStoredLLMConfig, saveStoredLLMConfig, OnlineLLMConfig } from '../lib/copilotIntelligence';

function getMessageText(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  return content.answer || content.response || content.text || content.message || JSON.stringify(content, null, 2);
}

export default function Copilot() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showAlert } = useTerminalAlert();
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [llmConfig, setLlmConfig] = useState<OnlineLLMConfig>(getStoredLLMConfig());
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: history } = useQuery({
    queryKey: ['copilot', caseId],
    queryFn: () => api.getCopilotHistory(caseId!),
    enabled: !!caseId,
  });

  const askMutation = useMutation({
    mutationFn: (q: string) => api.askCopilot(caseId!, q),
    onSuccess: (data, q) => {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: q, timestamp: new Date().toLocaleTimeString() },
        { role: 'assistant', content: data, timestamp: new Date().toLocaleTimeString() },
      ]);
      queryClient.invalidateQueries({ queryKey: ['copilot', caseId] });
    },
    onError: (err: any) => {
      showAlert(err?.response?.data?.detail || err?.message || 'Inference engine timeout', 'CRITICAL');
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, askMutation.isPending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || askMutation.isPending) return;
    const currentQ = query;
    setQuery('');
    askMutation.mutate(currentQ);
  };

  const handleSuggestedPrompt = (promptText: string) => {
    setQuery('');
    askMutation.mutate(promptText);
  };

  const handleClearHistory = () => {
    try {
      localStorage.removeItem(`spydee_copilot_history_${caseId}`);
      queryClient.invalidateQueries({ queryKey: ['copilot', caseId] });
      setMessages([]);
    } catch {}
  };

  const handleSaveConfig = () => {
    saveStoredLLMConfig(llmConfig);
    setShowConfigModal(false);
    showAlert('LLM configuration saved. Ready for direct answering.', 'SUCCESS');
  };

  const examples = [
    'What are the strongest leads and corroborated paths?',
    'Who are the top high-frequency actors in intercepted communications?',
    'Explain Alias-01 and associated financial transaction vectors',
    'What critical evidence contradicts current primary hypotheses?',
    'Identify intelligence gaps with zero corroborating subpoena records',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] font-mono text-xs text-[#f59e0b] space-y-2 relative">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-amber-500/40 gap-2 shrink-0">
        <div>
          <div className="text-[11px] text-amber-500/70 font-bold tracking-widest uppercase">
            // CASE CONSOLE // INVESTIGATOR COPILOT
          </div>
          <div className="text-base md:text-lg font-black text-amber-300 tracking-wider">
            NATURAL LANGUAGE FORENSIC QUERY ENGINE
          </div>
          <div className="text-[10px] text-amber-500/80">
            EVIDENTIARY CITATIONS // MULTI-HOP GRAPH QUERIES // ZERO-KEY DIRECT ANSWERING
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Engine Status & Config Button */}
          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-1.5 text-[10px] text-amber-300 bg-black/80 hover:bg-amber-950/40 px-3 py-1.5 border border-amber-500/40 hover:border-amber-400 transition-colors shadow-[0_0_10px_rgba(245,158,11,0.2)]"
            title="Configure or switch LLM integration"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {llmConfig.provider === 'auto'
                ? 'OPEN FORENSIC LLM ONLINE (ZERO-KEY)'
                : `${llmConfig.provider.toUpperCase()} LLM ACTIVE`}
            </span>
            <Settings className="w-3 h-3 text-amber-500/70 ml-1" />
          </button>

          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="px-2 py-1.5 bg-black/70 hover:bg-red-950/30 text-amber-500/70 hover:text-red-400 border border-amber-500/20 hover:border-red-500/40 text-[10px] transition-colors"
              title="Clear current interrogation window"
            >
              CLEAR WINDOW
            </button>
          )}
        </div>
      </div>

      {/* TERMINAL CHAT WINDOW */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-[#080c08] border border-amber-500/35 p-4 space-y-4 rounded-xs relative"
      >
        {/* CRT Background Grid Texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #f59e0b 1px, transparent 1px), linear-gradient(to bottom, #f59e0b 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* SYSTEM BANNER */}
        <div className="p-3 bg-[#0a0f0a] border border-amber-500/30 text-amber-400/90 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-300 font-bold">
              <Terminal className="w-4 h-4 text-amber-400" />
              <span>SPYDEE INTELLIGENCE COPILOT v2.4 (ZERO-CONFIG DIRECT REASONING)</span>
            </div>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5">
              AUTONOMOUS INFERENCE READY
            </span>
          </div>
          <p className="text-[11px] text-amber-500/80 leading-relaxed">
            Case corpus, suspect relationship graphs, CDR mobile streams, and National Datasets loaded. Ask any question regarding suspects, alibis, call volume spikes, cell towers, financial flows, or national datasets with immediate zero-key reasoning.
          </p>
        </div>

        {/* Prior sessions */}
        {messages.length === 0 && history && history.length > 0 && (
          <div className="border border-amber-500/30 bg-[#0a0f0a] p-3 rounded-xs space-y-2">
            <div className="text-[10px] text-amber-500/70 uppercase tracking-wider flex items-center justify-between">
              <span>PRIOR INTERROGATION LOGS (SAVED SESSIONS)</span>
              <div className="flex items-center gap-2">
                <span className="text-amber-500/50">{history.length} SESSIONS RECORDED</span>
                <button
                  onClick={handleClearHistory}
                  className="text-[9px] text-amber-500/50 hover:text-red-400 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>RESET LOGS</span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {history.slice(0, 4).map((m: any, idx: number) => (
                <div
                  key={m.id || idx}
                  onClick={() => handleSuggestedPrompt(m.query)}
                  className="bg-black/60 hover:bg-amber-950/20 border border-amber-500/30 hover:border-amber-400 p-2 cursor-pointer transition-colors text-xs space-y-1 group"
                >
                  <div className="text-amber-300 font-bold truncate group-hover:text-amber-200">
                    &gt; {m.query}
                  </div>
                  <div className="text-[10px] text-amber-500/70 line-clamp-2">
                    {m.response?.substring(0, 110)}...
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prompt Suggestions */}
        {messages.length === 0 && (
          <div className="text-center py-6 space-y-3">
            <div className="text-[10px] text-amber-500/70 uppercase tracking-widest">
              PRE-COMPILED RECONNAISSANCE QUERIES
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
              {examples.map((ex) => (
                <button
                  key={ex}
                  onClick={() => handleSuggestedPrompt(ex)}
                  className="text-xs bg-black/80 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-400 px-3 py-1.5 transition-colors text-left font-mono"
                >
                  &gt; {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Feed */}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} space-y-1`}
          >
            <div className="flex items-center gap-2 text-[10px] text-amber-500/70 uppercase">
              <span>{m.role === 'user' ? 'OPERATOR // DISPATCH' : 'ORACLE // SYNTHESIS'}</span>
              {m.timestamp && <span>· {m.timestamp}</span>}
            </div>

            <div
              className={`max-w-[90%] md:max-w-[85%] p-3.5 text-xs border ${
                m.role === 'user'
                  ? 'bg-amber-950/30 border-amber-500 text-amber-200'
                  : 'bg-[#0b100b] border-amber-500/40 text-amber-300 space-y-2 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
              }`}
            >
              {m.role === 'assistant' ? (
                <div className="space-y-3">
                  {/* Clean text rendering */}
                  <div className="whitespace-pre-wrap leading-relaxed font-mono text-xs text-amber-200">
                    {getMessageText(m.content)}
                  </div>

                  {/* Evidentiary Citations */}
                  {m.content?.citations?.length > 0 && (
                    <div className="pt-2 border-t border-amber-500/20 flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] text-amber-500/60 mr-1 select-none">
                        EVIDENTIARY CITATIONS:
                      </span>
                      {m.content.citations.map((c: any, k: number) => (
                        <span
                          key={k}
                          className="text-[9px] bg-black/80 text-amber-400/90 border border-amber-500/30 px-2 py-0.5 rounded-2xs"
                        >
                          {c.name || c.label || c.title || c.type?.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Deep Navigation Jump Links */}
                  {m.content?.links?.length > 0 && (
                    <div className="pt-2 border-t border-amber-500/25 flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] text-amber-500/70 self-center mr-1 select-none font-bold">
                        NAVIGATE TO:
                      </span>
                      {m.content.links.map((l: any, j: number) => {
                        if (l.type === 'contradiction')
                          return (
                            <button
                              key={j}
                              onClick={() => navigate(`/cases/${caseId}/contradictions`)}
                              className="text-[10px] bg-red-950/60 text-red-300 border border-red-500/50 px-2 py-0.5 hover:bg-red-900/60 font-bold transition-colors"
                            >
                              [ CONTRADICTION #{l.id ? String(l.id).slice(0, 6) : 'LINK'} ]
                            </button>
                          );
                        if (l.type === 'lead')
                          return (
                            <button
                              key={j}
                              onClick={() => navigate(`/cases/${caseId}/leads`)}
                              className="text-[10px] bg-amber-950/60 text-amber-300 border border-amber-500/50 px-2 py-0.5 hover:bg-amber-900/60 font-bold transition-colors"
                            >
                              [ LEAD RECORD ]
                            </button>
                          );
                        if (l.type === 'information_gap')
                          return (
                            <button
                              key={j}
                              onClick={() => navigate(`/cases/${caseId}/leads`)}
                              className="text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-500/50 px-2 py-0.5 hover:bg-emerald-900/60 font-bold transition-colors"
                            >
                              [ INTEL GAP ]
                            </button>
                          );
                        if (l.type === 'entity')
                          return (
                            <button
                              key={j}
                              onClick={() => navigate(`/cases/${caseId}/entities`)}
                              className="text-[10px] bg-black border border-amber-500/40 text-amber-300 px-2 py-0.5 hover:border-amber-400 font-bold transition-colors"
                            >
                              [ ENTITY DOSSIER ]
                            </button>
                          );
                        if (l.type === 'dataset')
                          return (
                            <button
                              key={j}
                              onClick={() => navigate(`/datasets`)}
                              className="text-[10px] bg-purple-950/60 text-purple-300 border border-purple-500/50 px-2 py-0.5 hover:bg-purple-900/60 font-bold transition-colors"
                            >
                              [ NATIONAL DATASETS ]
                            </button>
                          );
                        return null;
                      })}
                    </div>
                  )}

                  {/* Clickable Follow-up Queries */}
                  {m.content?.follow_ups?.length > 0 && (
                    <div className="pt-2 border-t border-amber-500/20 space-y-1">
                      <div className="text-[10px] text-amber-500/60 uppercase">
                        SUGGESTED NEXT INQUIRIES:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {m.content.follow_ups.map((fu: string, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => handleSuggestedPrompt(fu)}
                            className="text-[10px] bg-black/60 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-400 px-2 py-1 text-left transition-colors font-mono"
                          >
                            &gt; {fu}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="font-mono text-xs">{getMessageText(m.content)}</div>
              )}
            </div>
          </div>
        ))}

        {askMutation.isPending && (
          <div className="flex items-center gap-2 p-3 bg-black/60 border border-amber-500/30 text-amber-400 text-xs">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>[ TRAVERSING KNOWLEDGE GRAPH & SYNTHESIZING RESPONSE... ]</span>
          </div>
        )}
      </div>

      {/* INPUT COMMAND BAR */}
      <form onSubmit={handleSubmit} className="flex gap-2 shrink-0">
        <div className="flex-1 flex items-center bg-[#080c08] border border-amber-500/40 px-3 py-2 text-xs">
          <span className="text-amber-500 font-bold mr-2 select-none">COPILOT-PROMPT &gt;</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Interrogate case corpus, suspect links, CDR anomaly patterns..."
            disabled={askMutation.isPending}
            className="flex-1 bg-transparent text-amber-200 placeholder-amber-500/40 outline-none font-mono text-xs"
          />
        </div>

        <button
          type="submit"
          disabled={!query.trim() || askMutation.isPending}
          className="px-4 py-2 bg-amber-500 text-black font-bold hover:bg-amber-400 disabled:opacity-40 transition-colors flex items-center gap-1.5 shadow-[0_0_10px_rgba(245,158,11,0.4)] text-xs"
        >
          <Send className="w-3.5 h-3.5" />
          <span>[ TRANSMIT ]</span>
        </button>
      </form>

      {/* LLM CONFIGURATION MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#0b100b] border border-amber-500/50 p-5 max-w-md w-full space-y-4 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
            <div className="flex items-center justify-between pb-2 border-b border-amber-500/30">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                <Cpu className="w-4 h-4 text-amber-400" />
                <span>INTELLIGENCE COPILOT ENGINE CONFIGURATION</span>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-amber-500/60 hover:text-amber-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-2.5 bg-black/60 border border-emerald-500/30 text-emerald-300 text-[11px] leading-relaxed">
                <div className="font-bold flex items-center gap-1.5 mb-1 text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>ZERO-KEY DIRECT ANSWERING ACTIVE</span>
                </div>
                The built-in forensic intelligence engine operates completely without any API key or subscription. It directly traverses case entities, CDR records, physical alibi contradictions, and national datasets.
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-amber-400 font-bold block">
                  AI INFERENCE BACKEND PROVIDER
                </label>
                <select
                  value={llmConfig.provider}
                  onChange={(e) => setLlmConfig({ ...llmConfig, provider: e.target.value as any })}
                  className="w-full bg-black border border-amber-500/40 p-2 text-amber-200 outline-none font-mono text-xs"
                >
                  <option value="auto">SPYDEE Autonomous Forensic Engine (Recommended - Zero Key)</option>
                  <option value="groq">GroqCloud (Ultra-fast Llama 3.3 70B)</option>
                  <option value="openrouter">OpenRouter (Meta Llama 3.3 / Free Models)</option>
                  <option value="gemini">Google Gemini (Gemini 1.5 Flash)</option>
                  <option value="openai">OpenAI (GPT-4o-mini)</option>
                  <option value="ollama">Local Ollama (Offline / Self-hosted)</option>
                </select>
              </div>

              {llmConfig.provider !== 'auto' && llmConfig.provider !== 'ollama' && (
                <div className="space-y-1.5">
                  <label className="text-[11px] text-amber-400 font-bold block">
                    {llmConfig.provider.toUpperCase()} API KEY (OPTIONAL)
                  </label>
                  <input
                    type="password"
                    value={llmConfig.apiKey || ''}
                    onChange={(e) => setLlmConfig({ ...llmConfig, apiKey: e.target.value })}
                    placeholder={`Enter ${llmConfig.provider} API key...`}
                    className="w-full bg-black border border-amber-500/40 p-2 text-amber-200 placeholder-amber-500/30 outline-none font-mono text-xs"
                  />
                  <div className="text-[10px] text-amber-500/60">
                    Stored securely in your local browser storage. Never sent to any external server.
                  </div>
                </div>
              )}

              {llmConfig.provider === 'ollama' && (
                <div className="space-y-1.5">
                  <label className="text-[11px] text-amber-400 font-bold block">
                    OLLAMA BASE URL
                  </label>
                  <input
                    type="text"
                    value={llmConfig.baseUrl || 'http://localhost:11434'}
                    onChange={(e) => setLlmConfig({ ...llmConfig, baseUrl: e.target.value })}
                    placeholder="http://localhost:11434"
                    className="w-full bg-black border border-amber-500/40 p-2 text-amber-200 outline-none font-mono text-xs"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-amber-500/30">
              <button
                type="button"
                onClick={() => {
                  setLlmConfig({ provider: 'auto' });
                  saveStoredLLMConfig({ provider: 'auto' });
                  setShowConfigModal(false);
                }}
                className="px-3 py-1.5 border border-amber-500/30 text-amber-500/80 hover:text-amber-300 text-xs"
              >
                Reset to Default (Zero-Key)
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                className="px-4 py-1.5 bg-amber-500 text-black font-bold hover:bg-amber-400 text-xs transition-colors"
              >
                Save & Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
