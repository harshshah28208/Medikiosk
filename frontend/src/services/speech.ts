export class SpeechProvider {
  private recognition: any = null;
  private isListening = false;
  private currentAudio: HTMLAudioElement | null = null;
  private voicesCache: SpeechSynthesisVoice[] | null = null;
  private voicesLoaded = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
      }

      // Pre-load voices for faster switching
      this.loadVoices();
    }
  }

  isSpeechRecognitionSupported(): boolean {
    return !!this.recognition;
  }

  isSpeechSynthesisSupported(): boolean {
    return true;
  }

  private loadVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    // Load voices immediately
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      this.voicesCache = voices;
      this.voicesLoaded = true;
    } else {
      // Voices might not be loaded yet, wait for onvoiceschanged
      window.speechSynthesis.onvoiceschanged = () => {
        this.voicesCache = window.speechSynthesis.getVoices();
        this.voicesLoaded = true;
      };
    }
  }

  startListening(
    language: 'en' | 'hi' | 'gu',
    onResult: (transcript: string, isFinal: boolean) => void,
    onError: (error: string) => void,
    onEnd: () => void
  ) {
    if (!this.recognition) {
      onError('Voice input requires Google Chrome. Please use the on-screen keyboard instead.');
      return;
    }

    if (this.isListening) {
      this.stopListening();
    }

    const localeMap: Record<string, string> = {
      en: 'en-IN',
      hi: 'hi-IN',
      gu: 'gu-IN',
    };

    this.recognition.lang = localeMap[language] || 'en-IN';

    this.recognition.onstart = () => {
      this.isListening = true;
    };

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        onResult(finalTranscript.trim(), true);
      } else if (interimTranscript) {
        onResult(interimTranscript.trim(), false);
      }
    };

    this.recognition.onerror = (event: any) => {
      this.isListening = false;
      if (event.error === 'no-speech') {
        onError('No speech detected. Please tap the microphone and try speaking again.');
      } else {
        onError(event.error || 'Speech recognition error');
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      onEnd();
    };

    try {
      this.recognition.start();
    } catch (e: any) {
      onError(e.message || 'Failed to start microphone');
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {}
      this.isListening = false;
    }
  }

  private speakWithWebSpeech(cleanText: string, language: 'en' | 'hi' | 'gu'): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        resolve();
        return;
      }

      try {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        const langLocale = language === 'hi' ? 'hi-IN' : language === 'gu' ? 'gu-IN' : 'en-IN';
        utterance.lang = langLocale;
        utterance.rate = 0.95;
        utterance.pitch = 1.0;

        // Try to match appropriate localized voice from cache
        const voices = this.voicesCache && this.voicesLoaded ? this.voicesCache : window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          const match = voices.find(v => {
            const vLang = v.lang.replace('_', '-').toLowerCase();
            return vLang.startsWith(language) || vLang === langLocale.toLowerCase();
          });
          if (match) {
            utterance.voice = match;
          }
        }

        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();

        window.speechSynthesis.speak(utterance);
      } catch {
        resolve();
      }
    });
  }

  speak(text: string, language: 'en' | 'hi' | 'gu'): Promise<void> {
    return new Promise((resolve) => {
      if (!text || typeof window === 'undefined') {
        resolve();
        return;
      }

      this.stopSpeaking();

      const cleanText = text.replace(/[*_#`]/g, '').trim();
      const langParam = language === 'hi' ? 'hi' : language === 'gu' ? 'gu' : 'en';
      
      const rawApiBase =
        import.meta.env.VITE_API_BASE ||
        (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
          ? `${window.location.origin}/api`
          : 'http://localhost:5000/api');
      const cleanApiBase = rawApiBase.trim().replace(/\/+$/, '');
      const audioUrl = `${cleanApiBase}/conversation/tts?text=${encodeURIComponent(cleanText)}&lang=${langParam}`;

      const audio = new Audio(audioUrl);
      this.currentAudio = audio;

      let isFinished = false;
      const finish = () => {
        if (!isFinished) {
          isFinished = true;
          this.currentAudio = null;
          resolve();
        }
      };

      audio.onended = finish;

      audio.onerror = () => {
        // Fallback to browser Web Speech API if remote TTS is unreachable
        this.speakWithWebSpeech(cleanText, language).then(finish);
      };

      audio.play().catch(() => {
        // Autoplay policy fallback
        this.speakWithWebSpeech(cleanText, language).then(finish);
      });
    });
  }

  stopSpeaking() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
      this.currentAudio = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }
}

export const speechProvider = new SpeechProvider();
