import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  X,
  Send,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  Bot,
  User,
  HelpCircle,
} from 'lucide-react';
import { aiRepository, type AIMessage, type AIResponse } from '@/repositories/ai.repository';
import { Spinner } from '@/components/ui/Spinner';

const SUGGESTED_QUESTIONS = [
  'How do I add a new patient?',
  'How do I order and enter lab test results?',
  'How do I edit or adjust medicine stock?',
  'How does daily cash closing work?',
  'How do I admit an IPD patient to a bed?',
  'How do I add a new test to the lab catalog?',
  'How do I schedule an appointment?',
];

export function AIAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      role: 'assistant',
      content:
        'Hello! I am your **Hospital ERP Assistant**. Ask me anything about how to use this software, and I will give you clear step-by-step instructions and direct navigation links!',
    },
  ]);
  const [suggestedRoutes, setSuggestedRoutes] = useState<{ label: string; route: string }[]>([]);
  const [provider, setProvider] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  async function handleSend(textToSend?: string) {
    const query = (textToSend ?? input).trim();
    if (!query || loading) return;

    setInput('');
    const newMessages: AIMessage[] = [...messages, { role: 'user', content: query }];
    setMessages(newMessages);
    setLoading(true);

    try {
      // Pass recent history for multi-turn context
      const history = newMessages.slice(-6);
      const res = await aiRepository.askAssistant({ message: query, history });

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.reply },
      ]);
      setSuggestedRoutes(res.suggestedRoutes ?? []);
      setProvider(res.provider);
    } catch (err: any) {
      console.error('[AI Assistant] Error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            `I'm having trouble connecting to the server right now. Here are some quick links to help you navigate:\n\n` +
            `- [Patients](/patients) — Register or search patients\n` +
            `- [Appointments](/appointments) — Book doctor appointments\n` +
            `- [Laboratory](/laboratory/orders) — Lab orders & results\n` +
            `- [IPD Admissions](/ipd/admissions) — Inpatient admissions\n` +
            `- [Pharmacy](/pharmacy/medicines) — Medicines & stock\n` +
            `- [Billing](/billing/invoices) — Invoices & payments\n` +
            `- [Organization](/organization) — Hospital profile & settings\n\n` +
            `*Please try again in a moment, or click any link above to navigate directly.*`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleNavigate(route: string) {
    navigate(route);
  }

  function handleClear() {
    setMessages([
      {
        role: 'assistant',
        content:
          'Conversation reset. What feature or workflow in the Hospital ERP can I help you with?',
      },
    ]);
    setSuggestedRoutes([]);
  }

  // Format assistant markdown with bolding, links, bullet points
  function renderFormattedContent(content: string) {
    const lines = content.split('\n');

    return (
      <div className="space-y-1.5 text-xs md:text-sm leading-relaxed">
        {lines.map((line, idx) => {
          if (!line.trim()) {
            return <div key={idx} className="h-1.5" />;
          }

          // Header
          if (line.startsWith('### ')) {
            return (
              <h4 key={idx} className="font-semibold text-slate-900 mt-2 mb-1">
                {line.replace('### ', '')}
              </h4>
            );
          }

          // Blockquote (e.g. Permissions Note)
          if (line.startsWith('> ')) {
            return (
              <div
                key={idx}
                className="bg-amber-50 border-l-2 border-amber-500 px-2.5 py-1.5 text-xs text-amber-900 rounded-r my-1"
              >
                {renderInlineFormatting(line.replace('> ', ''))}
              </div>
            );
          }

          // Numbered item
          const numMatch = line.match(/^(\d+)\.\s+(.*)/);
          if (numMatch && numMatch[1] && numMatch[2]) {
            return (
              <div key={idx} className="flex gap-2 items-start pl-1">
                <span className="font-mono text-xs font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">
                  {numMatch[1]}
                </span>
                <span className="flex-1">{renderInlineFormatting(numMatch[2])}</span>
              </div>
            );
          }

          // Bullet item
          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <div key={idx} className="flex gap-2 items-start pl-2">
                <span className="text-teal-600 mt-1">•</span>
                <span className="flex-1">{renderInlineFormatting(line.slice(2))}</span>
              </div>
            );
          }

          return <p key={idx}>{renderInlineFormatting(line)}</p>;
        })}
      </div>
    );
  }

  // Parse inline bolding **text** and markdown links [Label](url)
  function renderInlineFormatting(text: string) {
    // Regex matches [Label](url) or **bold**
    const parts = text.split(/(\[.*?\]\(.*?\)|\*\*.*?\*\*)/g);

    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }

      const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
      if (linkMatch && linkMatch[1] && linkMatch[2]) {
        const label = linkMatch[1];
        const url = linkMatch[2];
        const isInternal = url.startsWith('/');

        return (
          <button
            key={i}
            type="button"
            className="inline-flex items-center gap-1 font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 hover:text-teal-800 px-1.5 py-0.5 rounded transition-colors text-xs mx-0.5"
            onClick={() => {
              if (isInternal) {
                handleNavigate(url);
              } else {
                window.open(url, '_blank');
              }
            }}
          >
            {label}
            <ExternalLink size={10} />
          </button>
        );
      }

      return part;
    });
  }

  return (
    <>
      {/* Floating Trigger Button */}
      <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="group flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-medium shadow-lg shadow-teal-700/25 hover:shadow-teal-600/40 transition-all duration-200 transform hover:scale-105 active:scale-95"
          aria-label="Open AI Assistant"
        >
          <div className="relative">
            <Sparkles size={18} className="animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
          </div>
          <span className="text-sm font-semibold tracking-wide hidden sm:inline">
            AI Assistant
          </span>
        </button>
      </div>

      {/* Slide-over Assistant Drawer / Dialog */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 md:bottom-20 md:right-6 z-50 w-[calc(100vw-2rem)] max-w-[440px] h-[580px] max-h-[80vh] flex flex-col rounded-2xl bg-white border border-slate-200/90 shadow-2xl shadow-slate-900/15 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="px-4 py-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-white shadow-sm">
                <Bot size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">Hospital ERP Assistant</h3>
                  {provider === 'gemini' && (
                    <span className="text-[10px] font-medium bg-teal-500/30 text-teal-200 border border-teal-400/40 px-1.5 py-0.2 rounded">
                      Gemini
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-300">Software guides & step-by-step help</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleClear}
                title="Reset conversation"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <RotateCcw size={15} />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div className="h-6 w-6 rounded-full bg-teal-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5 text-xs">
                    <Sparkles size={13} />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                    m.role === 'user'
                      ? 'bg-teal-600 text-white rounded-br-none'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                  }`}
                >
                  {m.role === 'user' ? (
                    <p className="text-xs md:text-sm">{m.content}</p>
                  ) : (
                    renderFormattedContent(m.content)
                  )}
                </div>

                {m.role === 'user' && (
                  <div className="h-6 w-6 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs">
                    <User size={13} />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 items-start">
                <div className="h-6 w-6 rounded-full bg-teal-600 text-white flex items-center justify-center flex-shrink-0 text-xs">
                  <Sparkles size={13} />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2 shadow-sm text-xs text-slate-500">
                  <Spinner size={14} />
                  <span>Thinking...</span>
                </div>
              </div>
            )}

            {/* Suggested Action Links from last answer */}
            {!loading && suggestedRoutes.length > 0 && (
              <div className="pt-1">
                <div className="text-[11px] font-medium text-slate-400 mb-1.5 flex items-center gap-1">
                  <span>Suggested Navigation:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedRoutes.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleNavigate(r.route)}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 hover:text-teal-800 transition-colors font-medium"
                    >
                      <span>{r.label}</span>
                      <ChevronRight size={12} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Prompt Pills if conversation is fresh */}
            {messages.length <= 2 && !loading && (
              <div className="pt-2">
                <div className="text-[11px] font-medium text-slate-400 mb-2 flex items-center gap-1">
                  <HelpCircle size={12} />
                  <span>Common Questions:</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {SUGGESTED_QUESTIONS.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(q)}
                      className="text-left text-xs px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-teal-300 hover:bg-teal-50/50 text-slate-700 hover:text-teal-800 transition-all flex items-center justify-between group shadow-2xs"
                    >
                      <span>{q}</span>
                      <ChevronRight
                        size={13}
                        className="text-slate-400 group-hover:text-teal-600 transition-transform group-hover:translate-x-0.5"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask how to do anything in the ERP..."
              disabled={loading}
              className="flex-1 text-xs md:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all text-slate-800 placeholder-slate-400 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-40 disabled:hover:bg-teal-600 transition-colors shadow-sm"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
