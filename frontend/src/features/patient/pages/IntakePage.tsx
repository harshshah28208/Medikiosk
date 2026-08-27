import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage, type LanguageCode } from '../../../store/LanguageContext';
import { api } from '../../../services/api';
import { speechProvider } from '../../../services/speech';
import {
  Mic, MicOff, Send, Volume2, VolumeX, ShieldAlert,
  Sparkles, CheckCircle2, User, Bot, RefreshCw, ArrowRight, CheckSquare
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'AI' | 'PATIENT';
  content: string;
  timestamp: string;
  options?: string[];
}

export function IntakePage() {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();

  const [session, setSession] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [touchOptions, setTouchOptions] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [redFlagAlert, setRedFlagAlert] = useState<any | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const activeLangRef = useRef<LanguageCode>(language);
  useEffect(() => {
    activeLangRef.current = language;
  }, [language]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, touchOptions]);

  // Start AI intake session on mount
  useEffect(() => {
    let isMounted = true;

    const initSession = async () => {
      setIsProcessing(true);
      try {
        const storedVisit = localStorage.getItem('medikiosk_active_visit');
        const parsedVisit = storedVisit ? JSON.parse(storedVisit) : null;
        const vId = visitId && visitId !== 'active' ? visitId : (parsedVisit?.id || 'active');

        const currentLang = activeLangRef.current;
        const res = await api.conversation.start(vId, currentLang.toUpperCase());

        if (isMounted && res?.session) {
          setSession(res.session);
          const initialMsg: ChatMessage = {
            id: res.message.id || 'welcome',
            role: 'AI',
            content: res.message.content,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            options: res.touchOptions || [],
          };
          setMessages([initialMsg]);
          setTouchOptions(res.touchOptions || []);

          if (audioEnabled) {
            speechProvider.speak(res.message.content, currentLang);
          }
        }
      } catch (err) {
        console.error('Conversation init error:', err);
      } finally {
        if (isMounted) setIsProcessing(false);
      }
    };

    initSession();

    return () => {
      isMounted = false;
      speechProvider.stopListening();
      speechProvider.stopSpeaking();
    };
  }, []);

  const handleSendMessage = async (textToSend: string, method: 'VOICE' | 'TEXT' | 'TOUCH' = 'TEXT') => {
    if (!textToSend.trim() || isProcessing) return;

    speechProvider.stopSpeaking();
    speechProvider.stopListening();
    setIsListening(false);

    const userMsg: ChatMessage = {
      id: `patient-${Date.now()}`,
      role: 'PATIENT',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setTouchOptions([]);
    setIsProcessing(true);

    try {
      const currentLang = activeLangRef.current;
      const sessionId = session?.id || 'demo-session';
      const res = await api.conversation.sendMessage(sessionId, {
        content: textToSend.trim(),
        inputMethod: method,
        language: currentLang.toUpperCase(),
      });

      if (res?.nextQuestion) {
        const aiMsg: ChatMessage = {
          id: res.aiMessage?.id || `ai-${Date.now()}`,
          role: 'AI',
          content: res.nextQuestion,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          options: res.touchOptions || [],
        };
        setMessages((prev) => [...prev, aiMsg]);
        setTouchOptions(res.touchOptions || []);

        if (res.hasRedFlag && res.redFlagAlert) {
          setRedFlagAlert(res.redFlagAlert);
        }

        if (res.isComplete) {
          setIsComplete(true);
          // If the patient explicitly chosen completion option (No, covers all symptoms), proceed immediately to next step
          if (/covers all symptoms|complete intake|सब लक्षण बता दिए|ઇન્ટેક પૂર્ણ|તમામ લક્ષણો જણાવી દીધા|no, that covers/i.test(textToSend)) {
            setTimeout(() => {
              handleCompleteIntake();
            }, 800);
            return;
          }
        }

        if (audioEnabled) {
          speechProvider.speak(res.nextQuestion, currentLang);
        }
      }
    } catch (err: any) {
      console.error('Send message error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      speechProvider.stopListening();
      setIsListening(false);
    } else {
      speechProvider.stopSpeaking();
      setIsListening(true);
      speechProvider.startListening(
        activeLangRef.current,
        (transcript, isFinal) => {
          setInputText(transcript);
          if (isFinal) {
            handleSendMessage(transcript, 'VOICE');
          }
        },
        (error) => {
          console.warn('Voice error:', error);
          setIsListening(false);
        },
        () => {
          setIsListening(false);
        }
      );
    }
  };

  const handleCompleteIntake = async () => {
    setIsProcessing(true);
    try {
      if (session?.id) {
        await api.conversation.complete(session.id);
      }
      navigate(`/kiosk/documents/${visitId || 'current'}`);
    } catch (err) {
      navigate(`/kiosk/documents/${visitId || 'current'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLanguageSwitch = async (newLang: LanguageCode) => {
    setLanguage(newLang);
    activeLangRef.current = newLang;
    speechProvider.stopSpeaking();

    if (session?.id) {
      setIsProcessing(true);
      try {
        const res = await api.conversation.switchLanguage(session.id, newLang.toUpperCase(), messages);
        
        if (res?.translatedMessages && res.translatedMessages.length > 0) {
          setMessages(res.translatedMessages);
        }

        if (res?.touchOptions) {
          setTouchOptions(res.touchOptions);
        }

        if (res?.latestQuestion && audioEnabled) {
          speechProvider.speak(res.latestQuestion, newLang);
        }
      } catch (err) {
        console.warn('Language switch translation fallback:', err);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const replayMessage = (content: string) => {
    speechProvider.speak(content, activeLangRef.current);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-between p-2 sm:p-6">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col h-[92vh] overflow-hidden">
        
        {/* Top Control Bar */}
        <header className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold flex items-center gap-2">
                <span>MediKiosk Clinical AI</span>
                <span className="text-[10px] px-2 py-0.5 bg-emerald-500/30 text-emerald-300 rounded-full font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Gemini 3.6 Flash
                </span>
              </h1>
              <p className="text-xs text-slate-400">Autonomous Clinical Intake • Multi-Turn Medical Interview</p>
            </div>
          </div>

          {/* Right Action Controls: Language Switcher, Done Intake Button & Mute toggle */}
          <div className="flex items-center gap-2">
            {/* Always Available Complete / Next Button */}
            {messages.length > 2 && (
              <button
                onClick={handleCompleteIntake}
                disabled={isProcessing}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all touch-target"
                title="Finish intake early and generate appointment report"
              >
                <CheckSquare className="w-4 h-4" />
                <span>
                  {language === 'hi' ? 'रिपोर्ट व अपॉइंटमेंट' : language === 'gu' ? 'રિપોર્ટ અને એપોઇન્ટમેન્ટ' : 'Go to Next (Report)'}
                </span>
              </button>
            )}

            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
              {(['en', 'hi', 'gu'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => handleLanguageSwitch(l)}
                  className={`
                    px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                    ${language === l
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                    }
                  `}
                >
                  {l === 'en' ? 'EN' : l === 'hi' ? 'हिन्दी' : 'ગુજરાતી'}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setAudioEnabled(!audioEnabled);
                if (audioEnabled) speechProvider.stopSpeaking();
              }}
              className={`p-2.5 rounded-xl transition-all ${
                audioEnabled
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'bg-slate-800 text-red-400'
              }`}
              title={audioEnabled ? 'Voice Enabled (Tap to Mute)' : 'Voice Muted (Tap to Enable)'}
            >
              {audioEnabled ? <Volume2 className="w-5 h-5 animate-pulse" /> : <VolumeX className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Emergency Red Flag Notice Banner */}
        {redFlagAlert && (
          <div className="p-4 bg-red-600 text-white flex items-center justify-between shadow-inner shrink-0">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 animate-pulse shrink-0" />
              <p className="text-xs sm:text-sm font-semibold">
                {redFlagAlert.patientNotice?.[language.toUpperCase() as 'EN' | 'HI' | 'GU'] || redFlagAlert.description}
              </p>
            </div>
            <span className="text-xs font-bold bg-white text-red-700 px-3 py-1 rounded-full uppercase tracking-wider shrink-0">
              Triage Alerted
            </span>
          </div>
        )}

        {/* Chat Conversation Scroll Area */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-50/50">
          {messages.map((msg) => {
            const isAI = msg.role === 'AI';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isAI ? 'justify-start' : 'justify-end'}`}
              >
                {isAI && (
                  <div className="w-9 h-9 bg-blue-600 text-white rounded-full flex items-center justify-center shrink-0 shadow-sm mt-1">
                    <Bot className="w-5 h-5" />
                  </div>
                )}

                <div
                  className={`
                    max-w-[82%] sm:max-w-[70%] p-4 rounded-3xl text-sm sm:text-base leading-relaxed shadow-sm relative group
                    ${isAI
                      ? 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-sm'
                      : 'bg-blue-600 text-white rounded-tr-sm shadow-blue-600/20'
                    }
                  `}
                >
                  <p>{msg.content}</p>
                  
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100/60">
                    <span
                      className={`block text-[10px] font-mono ${
                        isAI ? 'text-slate-400' : 'text-blue-200'
                      }`}
                    >
                      {msg.timestamp}
                    </span>

                    {isAI && (
                      <button
                        onClick={() => replayMessage(msg.content)}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium pl-2 touch-target"
                        title="Replay Voice"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold">Play Audio</span>
                      </button>
                    )}
                  </div>
                </div>

                {!isAI && (
                  <div className="w-9 h-9 bg-slate-800 text-white rounded-full flex items-center justify-center shrink-0 shadow-sm mt-1">
                    <User className="w-5 h-5" />
                  </div>
                )}
              </div>
            );
          })}

          {/* AI Thinking Indicator */}
          {isProcessing && (
            <div className="flex items-center gap-3 text-slate-500 text-sm">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center animate-pulse">
                <Sparkles className="w-4 h-4 text-blue-600" />
              </div>
              <span className="animate-pulse font-medium">
                {language === 'hi' ? 'क्लिनिकल AI विश्लेषण कर रहा है...' : language === 'gu' ? 'ક્લિનિકલ AI વિચારણા કરી રહ્યું છે...' : 'Clinical AI is evaluating...'}
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </main>

        {/* Quick Touch Options */}
        {touchOptions.length > 0 && !isProcessing && (
          <div className="p-3 bg-slate-100/80 border-t border-slate-200 shrink-0">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              {language === 'hi' ? 'त्वरित विकल्प चुनें:' : language === 'gu' ? 'ઝડપી વિકલ્પ પસંદ કરો:' : 'Quick Touch Options:'}
            </p>
            <div className="flex flex-wrap gap-2">
              {touchOptions.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(option, 'TOUCH')}
                  className="px-4 py-2.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-800 font-semibold text-xs sm:text-sm rounded-xl shadow-sm transition-all touch-target active:scale-95"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Input Action Bar */}
        <footer className="p-4 bg-white border-t border-slate-200 shrink-0 flex flex-col gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText, 'TEXT');
            }}
            className="flex items-center gap-2"
          >
            {/* Voice Input Button */}
            <button
              type="button"
              onClick={handleVoiceToggle}
              className={`
                p-3.5 rounded-2xl font-bold flex items-center justify-center transition-all shadow-md touch-target
                ${isListening
                  ? 'bg-red-600 text-white animate-bounce shadow-red-600/30'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20'
                }
              `}
              title={isListening ? 'Stop Listening' : 'Speak Your Symptoms'}
            >
              {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                language === 'hi'
                  ? 'यहाँ अपनी समस्या टाइप करें या माइक दबाकर बोलें...'
                  : language === 'gu'
                  ? 'અહીં આપની તકલીફ લખો અથવા માઇક દબાવીને બોલો...'
                  : 'Type your symptoms or tap the microphone to speak...'
              }
              disabled={isProcessing}
              className="flex-1 px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim() || isProcessing}
              className="p-3.5 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all touch-target"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>

          {/* Completion CTA */}
          {isComplete && (
            <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl animate-fade-in shadow-sm">
              <div className="flex items-center gap-2 text-emerald-800 text-xs sm:text-sm font-semibold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  {language === 'hi'
                    ? 'क्लिनिकल AI पूछताछ पूरी हुई! सभी विवरण रिकॉर्ड हो चुके हैं।'
                    : language === 'gu'
                    ? 'ક્લિનિકલ AI પૂછપરછ પૂર્ણ થઈ! તમામ વિગતો નોંધાઈ ગઈ છે.'
                    : 'Clinical questions completed! Ready for handover.'}
                </span>
              </div>
              <button
                onClick={handleCompleteIntake}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center gap-1.5 touch-target"
              >
                <span>{language === 'hi' ? 'अगला: रिपोर्ट व अपॉइंटमेंट' : language === 'gu' ? 'આગળ: રિપોર્ટ અને એપોઇન્ટમેન્ટ' : 'Go to Next & Generate Appointment'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
