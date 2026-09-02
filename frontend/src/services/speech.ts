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

  private preprocessTextForSpeech(text: string, language: 'en' | 'hi' | 'gu'): string {
    let clean = text.replace(/[*_#`]/g, '').trim();

    if (language === 'gu') {
      // Normalize common English medical & brand terms into Gujarati phonetics so Gujarati engine pronounces everything
      clean = clean
        .replace(/MediKiosk/gi, 'મેડિકિયોસ્ક')
        .replace(/Clinical AI/gi, 'ક્લિનિકલ એઆઈ')
        .replace(/AI/gi, 'એઆઈ')
        .replace(/Dr\./gi, 'ડોક્ટર')
        .replace(/Classical Homeopathy & Repertory/gi, 'ક્લાસિકલ હોમિયોપેથી અને રેપર્ટરી')
        .replace(/Classical Homeopathy/gi, 'ક્લાસિકલ હોમિયોપેથી')
        .replace(/Homeopathy/gi, 'હોમિયોપેથી')
        .replace(/Ayurveda/gi, 'આયુર્વેદ')
        .replace(/Allopathy/gi, 'એલોપેથી')
        .replace(/Cardiology/gi, 'હૃદયરોગ')
        .replace(/Orthopedics/gi, 'હાડકા અને સાંધા')
        .replace(/General Medicine/gi, 'સામાન્ય ચિકિત્સા')
        .replace(/OPD/gi, 'ઓપીડી')
        .replace(/BP/gi, 'બીપી')
        .replace(/SpO2/gi, 'ઓક્સિજન')
        .replace(/\(/g, ' ')
        .replace(/\)/g, ' ');
    } else if (language === 'hi') {
      clean = clean
        .replace(/MediKiosk/gi, 'मेडीकियोस्क')
        .replace(/Clinical AI/gi, 'क्लिनिकल एआई')
        .replace(/AI/gi, 'एआई')
        .replace(/Dr\./gi, 'डॉक्टर')
        .replace(/Classical Homeopathy & Repertory/gi, 'क्लासिकल होम्योपैथी और रेपर्टरी')
        .replace(/Classical Homeopathy/gi, 'क्लासिकल होम्योपैथी')
        .replace(/Homeopathy/gi, 'होम्योपैथी')
        .replace(/Ayurveda/gi, 'आयुर्वेद')
        .replace(/Allopathy/gi, 'एलोपैथी')
        .replace(/Cardiology/gi, 'कार्डियोलॉजी')
        .replace(/Orthopedics/gi, 'ऑर्थोपेडिक्स')
        .replace(/General Medicine/gi, 'जनरल मेडिसिन')
        .replace(/OPD/gi, 'ओपीडी')
        .replace(/BP/gi, 'बीपी')
        .replace(/SpO2/gi, 'ऑक्सीजन')
        .replace(/\(/g, ' ')
        .replace(/\)/g, ' ');
    }

    return clean.slice(0, 300);
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
        utterance.rate = 0.88;
        utterance.pitch = 1.0;

        // Strictly filter OUT English voices when language is Gujarati or Hindi
        const voices = (this.voicesCache && this.voicesLoaded) ? this.voicesCache : window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          let match: SpeechSynthesisVoice | undefined;

          if (language === 'gu') {
            // 1. Pure Gujarati voice
            match = voices.find(v => {
              const vLang = v.lang.replace('_', '-').toLowerCase();
              const vName = v.name.toLowerCase();
              return !vLang.startsWith('en') && !vName.includes('english') && (vLang.startsWith('gu') || vName.includes('gujarati') || vName.includes('dhwani') || vName.includes('niranjan') || vName.includes('shruti'));
            });

            // 2. Hindi Indic voice (Devanagari phonetics)
            if (!match) {
              match = voices.find(v => {
                const vLang = v.lang.replace('_', '-').toLowerCase();
                const vName = v.name.toLowerCase();
                return !vLang.startsWith('en') && !vName.includes('english') && (vLang.startsWith('hi') || vName.includes('hindi') || vName.includes('swara') || vName.includes('madhur') || vName.includes('kalpana'));
              });
            }
          } else if (language === 'hi') {
            match = voices.find(v => {
              const vLang = v.lang.replace('_', '-').toLowerCase();
              const vName = v.name.toLowerCase();
              return !vLang.startsWith('en') && !vName.includes('english') && (vLang.startsWith('hi') || vName.includes('hindi') || vName.includes('swara') || vName.includes('madhur') || vName.includes('kalpana'));
            });
          } else {
            match = voices.find(v => {
              const vLang = v.lang.replace('_', '-').toLowerCase();
              return vLang.startsWith('en-in') || vLang.startsWith('en');
            });
          }

          if (match) {
            utterance.voice = match;
            utterance.lang = match.lang;
          }
        }

        let isDone = false;
        const complete = () => {
          if (!isDone) {
            isDone = true;
            resolve();
          }
        };

        utterance.onend = complete;
        utterance.onerror = complete;

        // Chrome speech synthesis watchdog
        setTimeout(complete, Math.max(3500, cleanText.length * 130));

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

      // Preprocess text to ensure pure Gujarati/Hindi phonetics without embedded English skipping
      const cleanText = this.preprocessTextForSpeech(text, language);
      const langParam = language === 'hi' ? 'hi' : language === 'gu' ? 'gu' : 'en';
      
      const rawApiBase =
        import.meta.env.VITE_API_BASE ||
        (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
          ? `${window.location.origin}/api`
          : 'http://localhost:5000/api');
      const cleanApiBase = rawApiBase.trim().replace(/\/+$/, '');
      const audioUrl = `${cleanApiBase}/conversation/tts?text=${encodeURIComponent(cleanText)}&lang=${langParam}`;

      let isFinished = false;
      const finish = () => {
        if (!isFinished) {
          isFinished = true;
          this.currentAudio = null;
          resolve();
        }
      };

      const audio = new Audio();
      this.currentAudio = audio;

      // Watchdog: If audio stream takes > 4000ms to load/play, trigger immediate Web Speech fallback
      const watchdog = setTimeout(() => {
        if (!isFinished) {
          try { audio.pause(); } catch {}
          this.speakWithWebSpeech(cleanText, language).then(finish);
        }
      }, 4000);

      audio.onended = () => {
        clearTimeout(watchdog);
        finish();
      };

      audio.onerror = () => {
        clearTimeout(watchdog);
        this.speakWithWebSpeech(cleanText, language).then(finish);
      };

      audio.src = audioUrl;
      audio.play().catch(() => {
        clearTimeout(watchdog);
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
