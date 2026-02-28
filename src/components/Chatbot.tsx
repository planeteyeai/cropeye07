import React, { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Mic, MicOff, Send, Loader2, Minimize2, Play, Pause, Trash2 } from "lucide-react";
import { 
  getChatbotResponse, 
  detectLanguage,
  type Language,
  type UserRole
} from "../services/ruleBasedChatbot";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  language?: Language;
}

interface ChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: UserRole;
}

const Chatbot: React.FC<ChatbotProps> = ({ isOpen, onClose, userRole }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const lastBotMessageRef = useRef<string>("");
  const [hasAutoWelcomed, setHasAutoWelcomed] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const autoWelcomeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-welcome message after 5 seconds when chatbot opens
  useEffect(() => {
    if (isOpen && !hasAutoWelcomed && !isMinimized) {
      autoWelcomeTimerRef.current = setTimeout(() => {
        const welcomeMessage = getChatbotResponse("hello", userRole);
        const marathiWelcome = {
          text: welcomeMessage.text,
          language: "marathi" as Language
        };
        addMessage(marathiWelcome.text, false, marathiWelcome.language);
        speakText(marathiWelcome.text);
        setHasAutoWelcomed(true);
      }, 5000);
    }

    return () => {
      if (autoWelcomeTimerRef.current) {
        clearTimeout(autoWelcomeTimerRef.current);
      }
    };
  }, [isOpen, hasAutoWelcomed, userRole, isMinimized]);

  // Reset auto-welcome when chatbot closes
  useEffect(() => {
    if (!isOpen) {
      setHasAutoWelcomed(false);
    }
  }, [isOpen]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load available voices on mount
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
      console.log("Loaded voices:", voices.length);
      const marathiVoices = voices.filter(v => v.lang.startsWith('mr') || v.name.toLowerCase().includes('marathi'));
      if (marathiVoices.length > 0) {
        console.log("Marathi voices found:", marathiVoices.map(v => `${v.name} (${v.lang})`));
      } else {
        console.warn("No Marathi voices found. Available Indian voices:", 
          voices.filter(v => v.lang.includes('IN')).map(v => `${v.name} (${v.lang})`));
      }
    };

    if ('speechSynthesis' in window) {
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (autoWelcomeTimerRef.current) {
        clearTimeout(autoWelcomeTimerRef.current);
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  const addMessage = useCallback((text: string, isUser: boolean, language?: Language) => {
    const newMessage: Message = {
      id: Date.now().toString() + Math.random(),
      text,
      isUser,
      timestamp: new Date(),
      language,
    };
    setMessages((prev) => [...prev, newMessage]);
  }, []);

  // Pause audio playback
  const pauseAudio = () => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      setIsAudioPaused(true);
    }
  };

  // Play/Resume audio playback
  const playAudio = () => {
    if (lastBotMessageRef.current) {
      setIsAudioPaused(false);
      speakText(lastBotMessageRef.current);
    }
  };

  // Clear chat completely
  const clearChat = () => {
    window.speechSynthesis.cancel();
    setMessages([]);
    setInputText("");
    setHasAutoWelcomed(false);
    setIsPlayingAudio(false);
    setIsAudioPaused(false);
    lastBotMessageRef.current = "";
  };

  // Clean text for TTS - Remove markdown formatting and symbols
  const cleanTextForTTS = (text: string): string => {
    if (!text) return "";
    
    let cleaned = text;
    
    // Remove markdown bold: **text** → text
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
    
    // Remove markdown italic: *text* → text (but not if it's part of **)
    cleaned = cleaned.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1');
    
    // Remove markdown headers: # ## ### → empty
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
    
    // Remove markdown list markers: • - * → empty (keep the text)
    cleaned = cleaned.replace(/^[\s]*[•\-\*]\s+/gm, '');
    
    // Remove emojis (they might be read as text by TTS)
    cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
    cleaned = cleaned.replace(/[\u{2600}-\u{26FF}]/gu, '');
    cleaned = cleaned.replace(/[\u{2700}-\u{27BF}]/gu, '');
    
    // Remove extra whitespace and newlines (replace multiple newlines with single space)
    cleaned = cleaned.replace(/\n{2,}/g, ' ');
    cleaned = cleaned.replace(/\n/g, ' ');
    
    // Remove multiple spaces
    cleaned = cleaned.replace(/\s{2,}/g, ' ');
    
    // Trim
    cleaned = cleaned.trim();
    
    return cleaned;
  };

  // Text-to-Speech - Always use Marathi (Indian)
  const speakText = async (text: string): Promise<void> => {
    if (!text || !text.trim()) return;

    if (!("speechSynthesis" in window)) {
      console.warn("Speech synthesis not supported");
      return;
    }

    // Clean text for TTS - remove markdown formatting
    const cleanedText = cleanTextForTTS(text);

    if (!cleanedText || !cleanedText.trim()) {
      console.warn("Text is empty after cleaning");
      return;
    }

    return new Promise<void>((resolve) => {
      window.speechSynthesis.cancel();
      setIsAudioPaused(false);
      
      // Store the original text for replay (with formatting for display)
      lastBotMessageRef.current = text.trim();
      
      // Use available voices from state or load them
      const voices = availableVoices.length > 0 
        ? availableVoices 
        : window.speechSynthesis.getVoices();
      
      // Use cleaned text for TTS
      const utterance = new SpeechSynthesisUtterance(cleanedText.trim());
      
      // Try to find Marathi voice first
      let selectedVoice = voices.find(voice => 
        voice.lang === 'mr-IN' || 
        voice.lang.startsWith('mr-') ||
        (voice.name.toLowerCase().includes('marathi') && voice.lang.includes('IN'))
      );
      
      // If no Marathi, try Hindi (closest to Marathi)
      if (!selectedVoice) {
        selectedVoice = voices.find(voice => 
          voice.lang === 'hi-IN' || 
          voice.lang.startsWith('hi-')
        );
        if (selectedVoice) {
          utterance.lang = "hi-IN";
          console.log("⚠️ Using Hindi voice as fallback for Marathi:", selectedVoice.name);
        }
      }
      
      // If still no voice, try any Indian voice
      if (!selectedVoice) {
        selectedVoice = voices.find(voice => 
          voice.lang.includes('-IN') && 
          (voice.name.toLowerCase().includes('india') || 
           voice.name.toLowerCase().includes('indian'))
        );
      }
      
      // Set voice and language
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        if (!utterance.lang || utterance.lang === 'mr-IN') {
          utterance.lang = selectedVoice.lang;
        }
        console.log("✅ Using voice:", selectedVoice.name, "Language:", selectedVoice.lang);
      } else {
        // Fallback to default with Marathi language code
        utterance.lang = "mr-IN";
        console.warn("⚠️ No Marathi/Indian voice found, using default with mr-IN language code");
      }
      
      utterance.rate = 0.80; // Slightly slower for better Marathi pronunciation
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      setIsPlayingAudio(true);

      utterance.onstart = () => {
        console.log("🔊 Speech started - Language:", utterance.lang, "Voice:", utterance.voice?.name || "default");
      };

      utterance.onend = () => {
        console.log("✅ Speech completed");
        setIsPlayingAudio(false);
        setIsAudioPaused(false);
        resolve();
      };

      utterance.onerror = (event: any) => {
        console.error("❌ Speech error:", {
          error: event.error,
          type: event.type,
          lang: utterance.lang,
          voice: utterance.voice?.name
        });
        setIsPlayingAudio(false);
        setIsAudioPaused(false);
        
        // Show user-friendly message
        if (event.error === 'language-not-supported') {
          console.warn("⚠️ Marathi language not supported by browser. Please install Marathi TTS voices.");
        }
        resolve();
      };

      // Small delay to ensure voices are loaded
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 100);
    });
  };

  // Speech-to-Text with Web Speech API
  const startSpeechRecognition = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      addMessage("Speech recognition is not supported in your browser. Please use text input.", false);
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "mr-IN"; // Indian Marathi only

    let finalTranscript = "";

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = async (event: any) => {
      let interimTranscript = "";
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      const currentText = finalTranscript + interimTranscript;
      setInputText(currentText);
      
      if (finalTranscript.trim() && !interimTranscript) {
        setTimeout(() => {
          if (recognitionRef.current && recognitionRef.current.state === "running") {
            recognitionRef.current.stop();
          }
        }, 2000);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
      if (event.error === "no-speech") {
        addMessage("No speech detected. Please try again.", false);
      } else {
        addMessage("Speech recognition error. Please try typing instead.", false);
      }
    };

    recognition.onend = async () => {
      setIsRecording(false);
      
      const transcriptToSend = finalTranscript.trim();
      if (transcriptToSend) {
        await sendTextMessageWithText(transcriptToSend);
      } else {
        addMessage("No speech detected. Please try again.", false);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // Send text message
  const sendTextMessage = async () => {
    if (!inputText.trim() || isLoading) return;
    const message = inputText.trim();
    setInputText("");
    await sendTextMessageWithText(message);
  };

  const sendTextMessageWithText = async (message: string) => {
    if (!message.trim() || isLoading) return;

    const lang = detectLanguage(message);
    addMessage(message, true, lang);
    setIsLoading(true);

    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      const response = getChatbotResponse(message, userRole);
      
      addMessage(response.text, false, response.language);
      
      await speakText(response.text);
    } catch (error: any) {
      console.error("Chat error:", error);
      const errorMsg = "क्षमस्व, मला त्रुटी आली. कृपया पुन्हा प्रयत्न करा.";
      addMessage(errorMsg, false, "marathi");
    } finally {
      setIsLoading(false);
    }
  };

  const startVoiceRecording = async () => {
    startSpeechRecognition();
  };

  const stopVoiceRecording = () => {
    if (recognitionRef.current) {
      const currentState = recognitionRef.current.state;
      if (currentState === "running" || currentState === "listening") {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[99999]">
      {/* Single Frame - Minimized or Expanded */}
      {isMinimized ? (
        // Minimized State - Icon Only
        <div 
          className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-4 rounded-full shadow-2xl cursor-pointer hover:scale-110 transition-all duration-300 animate-bounce"
          onClick={() => setIsMinimized(false)}
          title="Expand Chatbot"
        >
          <MessageCircle className="w-6 h-6" />
          {messages.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
              {messages.length}
            </span>
          )}
        </div>
      ) : (
        // Expanded State - Full Chat Panel
        <div className="w-96 h-[650px] bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-200 animate-slide-up overflow-hidden">
          {/* Compact Header */}
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-3 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              <h3 className="font-semibold text-sm">CropEye</h3>
              {isRecording && (
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              )}
              {isPlayingAudio && (
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1 hover:bg-white/20 rounded transition-all duration-200 hover:scale-110"
                title="Minimize"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1 hover:bg-white/20 rounded transition-all duration-200 hover:scale-110"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area with Beautiful Agriculture Wallpaper */}
          <div 
            className="flex-1 overflow-y-auto p-4 space-y-3 relative"
            style={{
              background: `
                linear-gradient(135deg, 
                  rgba(34, 139, 34, 0.08) 0%, 
                  rgba(144, 238, 144, 0.12) 25%,
                  rgba(255, 255, 255, 0.98) 50%,
                  rgba(255, 215, 0, 0.08) 75%,
                  rgba(34, 139, 34, 0.08) 100%
                ),
                radial-gradient(ellipse 400px 300px at top left, rgba(34, 139, 34, 0.15) 0%, transparent 70%),
                radial-gradient(ellipse 400px 300px at bottom right, rgba(255, 215, 0, 0.12) 0%, transparent 70%),
                repeating-linear-gradient(
                  0deg,
                  transparent,
                  transparent 2px,
                  rgba(34, 139, 34, 0.02) 2px,
                  rgba(34, 139, 34, 0.02) 4px
                ),
                url("data:image/svg+xml,%3Csvg width='80' height='80' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='crop' x='0' y='0' width='40' height='40' patternUnits='userSpaceOnUse'%3E%3Cpath d='M20 8 Q25 15 20 22 Q15 15 20 8' stroke='%23228B22' stroke-width='1.5' fill='none' opacity='0.2'/%3E%3Cpath d='M8 28 Q13 35 8 42 Q3 35 8 28' stroke='%23228B22' stroke-width='1.5' fill='none' opacity='0.2'/%3E%3Cpath d='M32 28 Q37 35 32 42 Q27 35 32 28' stroke='%23228B22' stroke-width='1.5' fill='none' opacity='0.2'/%3E%3Cpath d='M20 22 L18 38 L20 42 L22 38 Z' stroke='%23228B22' stroke-width='1' fill='%23228B22' opacity='0.15'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='80' height='80' fill='url(%23crop)'/%3E%3C/svg%3E")
              `,
              backgroundSize: 'cover, 100% 100%, 100% 100%, auto, 80px 80px',
              backgroundPosition: 'center, top left, bottom right, center, center',
              backgroundRepeat: 'no-repeat, no-repeat, no-repeat, repeat, repeat',
              backgroundColor: '#f8fdf9'
            }}
          >
            {/* Beautiful overlay for better readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/50 via-white/30 to-white/70 pointer-events-none"></div>
            
            {/* Decorative agriculture elements - Crop patterns */}
            <div className="absolute top-8 left-8 w-28 h-28 opacity-8 pointer-events-none">
              <svg viewBox="0 0 100 100" className="w-full h-full text-green-600">
                {/* Crop plant with leaves */}
                <path d="M50 5 L55 35 L50 45 L45 35 Z" fill="currentColor" />
                <path d="M50 45 L48 70 L50 75 L52 70 Z" fill="currentColor" />
                <path d="M30 25 L35 55 L30 65 L25 55 Z" fill="currentColor" />
                <path d="M70 25 L75 55 L70 65 L65 55 Z" fill="currentColor" />
                <circle cx="50" cy="20" r="3" fill="currentColor" />
              </svg>
            </div>
            <div className="absolute bottom-16 right-8 w-24 h-24 opacity-8 pointer-events-none">
              <svg viewBox="0 0 100 100" className="w-full h-full text-green-500">
                {/* Grain/seed with stem */}
                <circle cx="50" cy="25" r="12" fill="currentColor" />
                <path d="M50 37 L45 60 L50 65 L55 60 Z" fill="currentColor" />
                <ellipse cx="50" cy="70" rx="8" ry="4" fill="currentColor" />
                <path d="M50 65 L50 85" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </div>
            <div className="absolute top-1/2 left-1/4 w-20 h-20 opacity-6 pointer-events-none transform -translate-x-1/2 -translate-y-1/2">
              <svg viewBox="0 0 100 100" className="w-full h-full text-yellow-500">
                {/* Sun */}
                <circle cx="50" cy="50" r="20" fill="currentColor" />
                <path d="M50 10 L52 30 L50 35 L48 30 Z" fill="currentColor" />
                <path d="M90 50 L70 52 L65 50 L70 48 Z" fill="currentColor" />
                <path d="M50 90 L52 70 L50 65 L48 70 Z" fill="currentColor" />
                <path d="M10 50 L30 52 L35 50 L30 48 Z" fill="currentColor" />
              </svg>
            </div>
            <div className="absolute top-1/3 right-1/4 w-16 h-16 opacity-7 pointer-events-none">
              <svg viewBox="0 0 100 100" className="w-full h-full text-green-400">
                {/* Small crop */}
                <path d="M50 15 L52 40 L50 48 L48 40 Z" fill="currentColor" />
                <path d="M50 48 L49 65 L50 68 L51 65 Z" fill="currentColor" />
              </svg>
            </div>
            
            <div className="relative z-10">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 text-sm py-12 animate-fade-in">
                  <div className="bg-white/80 backdrop-blur-sm rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center shadow-lg">
                    <MessageCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="font-medium">Ask me about farming!</p>
                  <p className="text-xs mt-2 text-green-600 animate-pulse">Auto-welcome in 5s...</p>
                </div>
              )}
              {messages.map((msg, index) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.isUser ? "justify-end" : "justify-start"} mb-3 animate-slide-in`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-lg transition-all duration-300 hover:scale-105 ${
                      msg.isUser
                        ? "bg-gradient-to-r from-green-500 to-green-600 text-white rounded-br-sm"
                        : "bg-white text-gray-800 rounded-bl-sm border border-gray-100"
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                    <span className={`text-[10px] mt-1 block ${msg.isUser ? 'text-green-100' : 'text-gray-400'}`}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start animate-fade-in">
                  <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-lg border border-gray-100">
                    <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Modern Input Area - Like Messaging App */}
          <div className="border-t border-gray-200 bg-white/95 backdrop-blur-sm p-3 rounded-b-2xl">
            <div className="flex items-end gap-2">
              {/* Pause Button */}
              {isPlayingAudio && !isAudioPaused && (
                <button
                  onClick={pauseAudio}
                  className="p-2 text-gray-600 hover:text-orange-600 hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110"
                  title="Pause Audio"
                >
                  <Pause className="w-5 h-5" />
                </button>
              )}
              
              {/* Play Button - Show when paused or when there's a message to replay */}
              {!isPlayingAudio && lastBotMessageRef.current && (
                <button
                  onClick={playAudio}
                  className="p-2 text-gray-600 hover:text-green-600 hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110"
                  title="Play Audio"
                >
                  <Play className="w-5 h-5" />
                </button>
              )}
              
              {/* Input Field */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && sendTextMessage()}
                  placeholder="Type a message..."
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-gray-50 hover:bg-white"
                  disabled={isLoading || isRecording}
                />
              </div>
              
              {/* Microphone Button */}
              <button
                onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                disabled={isLoading}
                className={`p-3 rounded-full transition-all duration-200 hover:scale-110 ${
                  isRecording
                    ? "bg-red-500 text-white animate-pulse shadow-lg"
                    : "bg-green-600 text-white hover:bg-green-700 shadow-md"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isRecording ? "Stop Recording" : "Voice Input"}
              >
                {isRecording ? (
                  <MicOff className="w-5 h-5" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </button>
              
              {/* Send Button - Only show when text exists */}
              {inputText.trim() && (
                <button
                  onClick={sendTextMessage}
                  disabled={isLoading || isRecording}
                  className="p-3 bg-green-600 text-white rounded-full hover:bg-green-700 disabled:opacity-50 transition-all duration-200 hover:scale-110 shadow-md"
                  title="Send"
                >
                  <Send className="w-5 h-5" />
                </button>
              )}
              
              {/* Clear Chat Button */}
              <button
                onClick={clearChat}
                disabled={isLoading || isRecording || messages.length === 0}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Clear Chat"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            
            {/* Status Indicators */}
            {(isRecording || isPlayingAudio) && (
              <div className="flex items-center gap-2 mt-2 text-xs">
                {isRecording && (
                  <span className="flex items-center gap-1 text-red-600">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    Recording...
                  </span>
                )}
                {isPlayingAudio && (
                  <span className="flex items-center gap-1 text-blue-600">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                    Speaking...
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Chatbot;
