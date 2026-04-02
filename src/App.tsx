import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, ArrowLeft, Power, ShieldCheck, Activity, ArrowRight, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { GoogleGenAI, Modality } from "@google/genai";

type Screen = 'START' | 'ASSESSMENT' | 'UPDATING' | 'SUCCESS';

const ANGER_STEPS = [
  { emoji: '😡', text: 'Extremely Angry', color: '#2A1115', voice: 'Extremely angry. Danger zone.' },
  { emoji: '😒', text: 'Still mad… fair.', color: '#29151A', voice: 'Still mad. Understandable.' },
  { emoji: '🙂', text: 'Okay… I see hope 👀', color: '#28181E', voice: 'Okay. I see a glimmer of hope.' },
  { emoji: '😌', text: 'Wait… are we smiling??', color: '#271B23', voice: 'Wait. Is that a smile?' },
  { emoji: '❤️', text: 'System stabilizing… miracle detected.', color: '#261E28', voice: 'System stabilizing. A miracle has been detected.' },
];

const UPDATE_PHASES = [
  "Learning…",
  "Processing…",
  "Installing better behavior…"
];

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const Typewriter = ({ text, onComplete }: { text: string; onComplete?: () => void }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let isMounted = true;
    setDisplayedText('');
    let i = 0;
    
    // Small delay to ensure the component is fully mounted and visible
    const startTimeout = setTimeout(() => {
      const interval = setInterval(() => {
        if (!isMounted) return;
        if (i < text.length) {
          setDisplayedText(text.substring(0, i + 1));
          i++;
        } else {
          clearInterval(interval);
          if (onComplete) setTimeout(onComplete, 1500);
        }
      }, 70);
      return () => clearInterval(interval);
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(startTimeout);
    };
  }, [text]);

  return (
    <div className="min-h-[140px] flex items-center justify-center w-full px-2 overflow-visible">
      <h2 className="font-heading text-2xl md:text-4xl text-center leading-tight break-words max-w-full">
        <span className="inline-block">{displayedText}</span>
        <motion.span
          animate={{ opacity: [0, 1, 0] }}
          transition={{ repeat: Infinity, duration: 0.8 }}
          className="inline-block w-[3px] h-[0.8em] bg-primary ml-1 align-baseline translate-y-[0.1em]"
        />
      </h2>
    </div>
  );
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('START');
  const [angerLevel, setAngerLevel] = useState(0);
  const [updatePhase, setUpdatePhase] = useState(0);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isMusicLoading, setIsMusicLoading] = useState(false);
  
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);

  const currentStep = ANGER_STEPS[angerLevel];

  const playVoice = useCallback(async (text: string) => {
    if (!isAudioEnabled) return;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say playfully and softly: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioSrc = `data:audio/wav;base64,${base64Audio}`;
        if (voiceAudioRef.current) {
          voiceAudioRef.current.src = audioSrc;
          voiceAudioRef.current.play();
        }
      }
    } catch (error) {
      console.error("Voice generation failed:", error);
    }
  }, [isAudioEnabled]);

  const generateMusic = async () => {
    if (musicAudioRef.current?.src || isMusicLoading) return;
    setIsMusicLoading(true);
    try {
      const response = await ai.models.generateContentStream({
        model: "lyria-3-clip-preview",
        contents: 'Generate a 30-second soft, velvety, romantic, slightly comedic background track for a relationship apology app.',
      });

      let audioBase64 = "";
      let mimeType = "audio/wav";

      for await (const chunk of response) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;
        for (const part of parts) {
          if (part.inlineData?.data) {
            if (!audioBase64 && part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
            audioBase64 += part.inlineData.data;
          }
        }
      }

      const binary = atob(audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      const audioUrl = URL.createObjectURL(blob);
      
      if (musicAudioRef.current) {
        musicAudioRef.current.src = audioUrl;
        musicAudioRef.current.loop = true;
        if (isAudioEnabled) musicAudioRef.current.play();
      }
    } catch (error) {
      console.error("Music generation failed:", error);
    } finally {
      setIsMusicLoading(false);
    }
  };

  useEffect(() => {
    if (isAudioEnabled) {
      generateMusic();
      musicAudioRef.current?.play().catch(() => {});
    } else {
      musicAudioRef.current?.pause();
    }
  }, [isAudioEnabled]);

  useEffect(() => {
    if (screen === 'ASSESSMENT') {
      playVoice(currentStep.voice);
    }
  }, [angerLevel, screen, playVoice]);

  useEffect(() => {
    if (screen === 'UPDATING') {
      playVoice(UPDATE_PHASES[updatePhase]);
    }
  }, [updatePhase, screen, playVoice]);

  useEffect(() => {
    if (screen === 'SUCCESS') {
      playVoice("Mr. May's Update complete. Chances of repeating stupidity: significantly reduced. You are welcome.");
    }
  }, [screen, playVoice]);

  const handleStart = () => {
    setScreen('ASSESSMENT');
    if (!isAudioEnabled) setIsAudioEnabled(true);
  };

  const handleForgive = () => setScreen('UPDATING');

  const handlePhaseComplete = () => {
    if (updatePhase < UPDATE_PHASES.length - 1) {
      setUpdatePhase(prev => prev + 1);
    } else {
      setScreen('SUCCESS');
    }
  };

  return (
    <div 
      className="fixed inset-0 flex flex-col transition-colors duration-500 ease-in-out"
      style={{ backgroundColor: screen === 'START' ? '#2A1115' : currentStep.color }}
    >
      <audio ref={musicAudioRef} />
      <audio ref={voiceAudioRef} />

      {/* Audio Toggle */}
      <button 
        onClick={() => setIsAudioEnabled(!isAudioEnabled)}
        className="fixed top-6 right-6 z-50 w-12 h-12 rounded-full bg-surface/50 backdrop-blur-md flex items-center justify-center text-text border border-white/10"
      >
        {isAudioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
      </button>

      <AnimatePresence mode="wait">
        {screen === 'START' && (
          <motion.div
            key="start"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col items-center justify-between py-16 px-6"
          >
            <div className="text-center space-y-2">
              <motion.h1 
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ repeat: Infinity, duration: 4 }}
                className="font-heading text-[32px] text-text"
              >
                Damage Control
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-accent font-heading text-xl"
              >
                Hey Hari 🩵
              </motion.p>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(255, 75, 114, 0.6)' }}
              whileTap={{ scale: 0.95 }}
              onClick={handleStart}
              className="w-48 h-48 rounded-full bg-primary flex flex-col items-center justify-center shadow-glow group relative"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute inset-0 rounded-full bg-primary/20"
              />
              <span className="font-heading text-2xl text-white mb-2 z-10">Start</span>
              <Power className="text-white w-8 h-8 group-hover:rotate-12 transition-transform z-10" />
            </motion.button>

            <p className="text-muted text-sm font-bold uppercase tracking-widest">
              Initiate Apology Protocol
            </p>
          </motion.div>
        )}

        {screen === 'ASSESSMENT' && (
          <motion.div
            key="assessment"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center py-12 px-6"
          >
            <div className="w-full flex items-center justify-between mb-12">
              <button 
                onClick={() => setScreen('START')}
                className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-text"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="font-heading text-2xl text-text">Damage Control</h1>
              <div className="w-10" />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center w-full">
              <motion.div
                key={angerLevel}
                initial={{ scale: 0.8, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="w-64 h-64 rounded-full border-4 border-primary/30 flex items-center justify-center relative"
              >
                <motion.div 
                  animate={{ 
                    boxShadow: angerLevel === 4 ? [
                      '0 0 20px rgba(255,75,114,0.2)',
                      '0 0 60px rgba(255,75,114,0.4)',
                      '0 0 20px rgba(255,75,114,0.2)'
                    ] : '0 0 20px rgba(255,75,114,0.2)'
                  }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 rounded-full" 
                />
                <span className="text-8xl select-none">{currentStep.emoji}</span>
              </motion.div>
            </div>

            <div className="w-full space-y-8 mt-auto">
              <motion.div 
                key={angerLevel}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-center"
              >
                <p className="text-2xl font-bold text-text">
                  {currentStep.text}
                </p>
              </motion.div>

              <div className="px-4">
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="1"
                  value={angerLevel}
                  onChange={(e) => setAngerLevel(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              <motion.button
                disabled={angerLevel < 4}
                onClick={handleForgive}
                whileHover={angerLevel === 4 ? { scale: 1.02 } : {}}
                whileTap={angerLevel === 4 ? { scale: 0.98 } : {}}
                animate={{ 
                  opacity: angerLevel === 4 ? 1 : 0.4,
                  scale: angerLevel === 4 ? 1 : 0.98,
                  backgroundColor: angerLevel === 4 ? '#FF4B72' : '#3D262C'
                }}
                className="w-full py-5 rounded-pill font-heading text-lg text-white transition-all duration-300 shadow-glow"
              >
                Fine, I forgive you (maybe)
              </motion.button>
            </div>
          </motion.div>
        )}

        {screen === 'UPDATING' && (
          <motion.div
            key="updating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center px-6"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.3, 1],
                rotate: [0, 10, -10, 0],
                opacity: [0.6, 1, 0.6]
              }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="mb-12"
            >
              <Heart size={80} className="text-primary fill-primary drop-shadow-[0_0_20px_rgba(255,75,114,0.8)]" />
            </motion.div>
            
            <Typewriter 
              text={UPDATE_PHASES[updatePhase]} 
              onComplete={handlePhaseComplete} 
            />
          </motion.div>
        )}

        {screen === 'SUCCESS' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="relative mb-12">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 10, stiffness: 100 }}
                className="w-32 h-32 bg-primary rounded-full flex items-center justify-center shadow-glow"
              >
                <Heart size={64} className="text-white fill-white" />
              </motion.div>
              
              {/* Particle effects */}
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ 
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0.5],
                    x: Math.cos(i * 60 * Math.PI / 180) * 100,
                    y: Math.sin(i * 60 * Math.PI / 180) * 100,
                  }}
                  transition={{ repeat: Infinity, duration: 2, delay: i * 0.2 }}
                  className="absolute top-1/2 left-1/2"
                >
                  <Sparkles className="text-accent w-6 h-6 -translate-x-1/2 -translate-y-1/2" />
                </motion.div>
              ))}
            </div>

            <motion.h2 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="font-heading text-2xl md:text-3xl mb-4 px-4"
            >
              Mr. May's Update complete.
            </motion.h2>
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-muted text-base md:text-lg mb-12 px-6"
            >
              Chances of repeating stupidity: Reduced.
            </motion.p>

            <div className="grid grid-cols-2 gap-4 w-full mb-12">
              <motion.div 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="bg-surface/50 p-4 rounded-2xl border border-white/5 backdrop-blur-sm"
              >
                <ShieldCheck className="text-primary mb-2 mx-auto" />
                <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Protocol</p>
                <p className="font-bold">Secured</p>
              </motion.div>
              <motion.div 
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="bg-surface/50 p-4 rounded-2xl border border-white/5 backdrop-blur-sm"
              >
                <Activity className="text-primary mb-2 mx-auto" />
                <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Status</p>
                <p className="font-bold">Healthy</p>
              </motion.div>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setScreen('START');
                setAngerLevel(0);
                setUpdatePhase(0);
              }}
              className="bg-primary text-white font-heading px-10 py-4 rounded-pill shadow-glow flex items-center gap-2"
            >
              Back to panel <ArrowRight size={20} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
