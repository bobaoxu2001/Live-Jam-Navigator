import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, CloudRain, Zap, Music, Radio, Activity, Wind, MapPin, Disc, Volume2, Sparkles, AlertCircle, RefreshCw, Mic, Edit3, Sliders, AlignLeft } from 'lucide-react';

// --- Data Models & Constants ---

// Using SoundHelix for demo purposes (Royalty free demo tracks)
const GENRE_TRACKS = {
  electronic: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  jazz: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', // Slower, more melodic
  pop: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', // Upbeat
  hiphop: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', // Rhythmic
  ambient: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3', // Atmospheric
};

const GENRES = {
  electronic: { color: '#ef4444', label: 'Techno/House', vibe: 'High Energy' },
  jazz: { color: '#3b82f6', label: 'Jazz/Blues', vibe: 'Chill' },
  pop: { color: '#ec4899', label: 'City Pop/K-Pop', vibe: 'Upbeat' },
  hiphop: { color: '#f59e0b', label: 'Hip Hop/Trap', vibe: 'Rhythmic' },
  ambient: { color: '#10b981', label: 'Ambient/Lo-fi', vibe: 'Atmospheric' },
};

const CITIES = [
  { id: 'nyc', name: 'New York', x: 280, y: 180, baseGenre: 'hiphop', timezone: -5, defaultTheme: "Concrete Dreams" },
  { id: 'ldn', name: 'London', x: 490, y: 150, baseGenre: 'electronic', timezone: 0, defaultTheme: "Grey Sky Hustle" },
  { id: 'tok', name: 'Tokyo', x: 860, y: 190, baseGenre: 'pop', timezone: 9, defaultTheme: "Neon Solitude" },
  { id: 'rio', name: 'Rio de Janeiro', x: 340, y: 400, baseGenre: 'jazz', timezone: -3, defaultTheme: "Tropical Heat" },
  { id: 'ber', name: 'Berlin', x: 520, y: 160, baseGenre: 'electronic', timezone: 1, defaultTheme: "Industrial Pulse" },
  { id: 'lax', name: 'Los Angeles', x: 180, y: 200, baseGenre: 'pop', timezone: -8, defaultTheme: "Sunset Boulevard" },
  { id: 'mum', name: 'Mumbai', x: 700, y: 240, baseGenre: 'ambient', timezone: 5.5, defaultTheme: "Monsoon Chaos" },
  { id: 'syd', name: 'Sydney', x: 920, y: 450, baseGenre: 'electronic', timezone: 11, defaultTheme: "Ocean Drive" },
];

// --- Helper Components ---

const NeonCard = ({ children, className = "" }) => (
  <div className={`bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-[0_0_15px_rgba(0,0,0,0.5)] ${className}`}>
    {children}
  </div>
);

// --- Gemini API Integration ---

const callGemini = async (systemPrompt, userPrompt) => {
  // Get API Key from Environment Variable (Vite)
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

  if (!apiKey) {
      console.warn("No API Key found. Please set VITE_GEMINI_API_KEY in .env");
      return null;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        }),
      }
    );

    if (!response.ok) throw new Error("Gemini API Error");
    const data = await response.json();
    return JSON.parse(data.candidates[0].content.parts[0].text);
  } catch (error) {
    console.error("Gemini failed, falling back to local:", error);
    return null; // Fallback signal
  }
};

// --- Main Application ---

export default function App() {
  const [selectedCity, setSelectedCity] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [generatedTrack, setGeneratedTrack] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [lyrics, setLyrics] = useState([]);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0);
  const [userTheme, setUserTheme] = useState("");
  const [globalTime, setGlobalTime] = useState(new Date());
  const [stormActive, setStormActive] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);

  // Real Audio Ref
  const audioRef = useRef(new Audio());
  const lyricTimerRef = useRef(null);

  // Simulation State
  const [cityData, setCityData] = useState(
    CITIES.map(c => ({
      ...c,
      bpm: 100 + Math.random() * 40,
      activeUsers: Math.floor(Math.random() * 5000),
      currentMood: 'Neutral'
    }))
  );

  // --- Real Audio Engine ---

  useEffect(() => {
    const audio = audioRef.current;

    const handleEnded = () => {
        setIsPlaying(false);
        setCurrentLyricIndex(0);
    };
    const handleCanPlay = () => setAudioLoading(false);
    const handleWaiting = () => setAudioLoading(true);
    const handleError = (e) => {
        console.error("Audio error", e);
        setAudioLoading(false);
        setIsPlaying(false);
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audio.src = "";
    };
  }, []);

  const playRealTrack = (genreKey) => {
    const audio = audioRef.current;
    const trackUrl = GENRE_TRACKS[genreKey];

    if (!trackUrl) return;

    if (audio.src === trackUrl && audio.paused) {
        audio.play().catch(e => console.error("Play failed", e));
        return;
    }

    setAudioLoading(true);
    audio.src = trackUrl;
    audio.volume = 0.6;
    audio.play().catch(e => console.error("Play failed", e));
  };

  const pauseTrack = () => {
      audioRef.current.pause();
  };

  // Sync Lyrics with Playback (Simulated Karaoke)
  useEffect(() => {
    if (isPlaying && lyrics.length > 0) {
        // Slightly faster pace for a more energetic feel
        lyricTimerRef.current = setInterval(() => {
            setCurrentLyricIndex(prev => (prev + 1) % lyrics.length);
        }, 3500);
    } else {
        clearInterval(lyricTimerRef.current);
    }
    return () => clearInterval(lyricTimerRef.current);
  }, [isPlaying, lyrics]);

  useEffect(() => {
    if (isPlaying && generatedTrack) {
       playRealTrack(selectedCity.baseGenre);
    } else {
       pauseTrack();
    }
  }, [isPlaying, generatedTrack, selectedCity]);


  // --- Particle System ---
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    canvas.width = 1000;
    canvas.height = 600;

    const particles = [];
    for (let i = 0; i < 100; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 1,
        vy: (Math.random() - 0.5) * 1,
        life: Math.random() * 100,
        color: '#ffffff'
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 0.05;
      ctx.strokeStyle = stormActive ? '#a855f7' : '#3b82f6';
      ctx.lineWidth = 1;

      particles.forEach((p) => {
        p.x += p.vx * (stormActive ? 5 : 1);
        p.y += p.vy * (stormActive ? 5 : 1);
        p.life--;

        if (p.life <= 0 || p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
          const startCity = CITIES[Math.floor(Math.random() * CITIES.length)];
          p.x = startCity.x + (Math.random() - 0.5) * 50;
          p.y = startCity.y + (Math.random() - 0.5) * 50;
          p.life = 100 + Math.random() * 100;
          const endCity = CITIES[Math.floor(Math.random() * CITIES.length)];
          const angle = Math.atan2(endCity.y - p.y, endCity.x - p.x);
          p.vx = Math.cos(angle) * (1 + Math.random());
          p.vy = Math.sin(angle) * (1 + Math.random());
          p.color = GENRES[startCity.baseGenre].color;
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 200;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });
      animationFrameId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [stormActive]);

  useEffect(() => {
    const interval = setInterval(() => {
      setGlobalTime(new Date());
      setCityData(prev => prev.map(c => ({
        ...c,
        bpm: Math.max(60, Math.min(180, c.bpm + (Math.random() - 0.5) * 5)),
        activeUsers: Math.max(100, c.activeUsers + Math.floor((Math.random() - 0.5) * 100)),
        currentMood: ['Energetic', 'Melancholic', 'Chill', 'Aggressive', 'Euphonic'][Math.floor(Math.random() * 5)]
      })));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // --- Logic: Prompt & Lyric Engineering Engine ---

  const generateLocalPrompt = (city, timeOfDay, weather) => {
    const genreInfo = GENRES[city.baseGenre];
    let prompt = `A ${genreInfo.label} track, ${timeOfDay} vibe in ${city.name}, `;
    prompt += `${Math.floor(city.bpm)} BPM, `;
    prompt += `${city.currentMood} emotional tone.`;
    return prompt;
  };

  const handleCityClick = async (city) => {
    if (isGenerating) return;
    setSelectedCity(city);
    setIsGenerating(true);
    setGeneratedTrack(null);
    setAiReport(null);
    setLyrics([]);
    setCurrentLyricIndex(0);
    setIsPlaying(false);

    // Stop current audio
    audioRef.current.pause();

    // Context calculation
    const timeHour = (globalTime.getUTCHours() + city.timezone + 24) % 24;
    let timeOfDay = 'Midday';
    if (timeHour >= 22 || timeHour < 5) timeOfDay = 'Late Night';
    else if (timeHour >= 5 && timeHour < 12) timeOfDay = 'Morning';
    else if (timeHour >= 18) timeOfDay = 'Sunset';
    const weather = stormActive ? 'Stormy' : ['Clear', 'Rainy', 'Foggy'][Math.floor(Math.random() * 3)];

    // Use user theme or fallback to city default
    const activeTheme = userTheme.trim() !== "" ? userTheme : city.defaultTheme;

    // Gemini AI Call
    const systemPrompt = `You are the core AI of "Live Jam Navigator".
    Your task:
    1. Generate a highly specific Suno AI prompt based on city data and user theme.
    2. Write a "Sonic Weather Report" (1 sentence).
    3. Generate 4 lines of abstract, poetic song lyrics that fit the theme and genre.

    Output JSON format:
    {
      "sunoPrompt": "string",
      "weatherReport": "string",
      "lyrics": ["line1", "line2", "line3", "line4"]
    }`;

    const userPrompt = `
    City: ${city.name}
    Genre: ${GENRES[city.baseGenre].label}
    User Theme: ${activeTheme}
    Time: ${timeOfDay}
    Weather: ${weather}
    BPM: ${Math.floor(city.bpm)}
    Current Mood: ${city.currentMood}
    `;

    let result = null;
    try {
      result = await callGemini(systemPrompt, userPrompt);
    } catch (e) {
      console.warn("Gemini call failed silently", e);
    }

    if (result) {
      setGeneratedTrack({
        title: `${activeTheme} @ ${city.name}`, // Dynamic Title
        prompt: result.sunoPrompt,
        duration: 'DEMO',
        coverColor: GENRES[city.baseGenre].color
      });
      setAiReport(result.weatherReport);
      setLyrics(result.lyrics || []);
    } else {
      // Fallback
      setGeneratedTrack({
        title: `${city.name} Session (Offline)`,
        prompt: generateLocalPrompt(city, timeOfDay, weather),
        duration: 'DEMO',
        coverColor: GENRES[city.baseGenre].color
      });
      setAiReport("Uplink unstable. Using local telemetry algorithms.");
      setLyrics(["Signal interference...", "Lyrics data packet lost...", "Reconnecting to satellite...", "Just enjoy the vibes..."]);
    }

    setIsGenerating(false);
    setIsPlaying(true);
  };

  const handlePlayToggle = () => {
      setIsPlaying(!isPlaying);
  };

  // Helper to handle input change without triggering regen immediately
  const handleThemeChange = (e) => {
      setUserTheme(e.target.value);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans overflow-hidden selection:bg-purple-500 selection:text-white">

      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

      {/* --- HEADER --- */}
      <header className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <h1 className="text-3xl font-bold tracking-tighter flex items-center gap-2">
            <Radio className="w-8 h-8 text-purple-500 animate-pulse" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-500">
              LIVE JAM NAVIGATOR
            </span>
          </h1>
          <p className="text-xs text-gray-500 uppercase tracking-[0.3em] mt-1 flex items-center gap-2">
             <Sparkles className="w-3 h-3 text-yellow-400" />
             Powered by Gemini 2.5 & Suno
          </p>
        </div>

        <div className="flex gap-4 pointer-events-auto">
          <button
            onClick={() => setStormActive(!stormActive)}
            className={`px-4 py-2 rounded-full border text-xs font-bold transition-all flex items-center gap-2 ${stormActive ? 'bg-purple-600 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.5)]' : 'bg-black/50 border-gray-700 hover:border-white'}`}
          >
            <Zap className="w-4 h-4" />
            {stormActive ? 'GENRE STORM ACTIVE' : 'TRIGGER EVENT'}
          </button>
          <div className="bg-black/50 border border-gray-800 rounded-full px-4 py-2 text-xs font-mono text-gray-400 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            LIVE FEED
          </div>
        </div>
      </header>

      {/* --- MAIN MAP AREA --- */}
      <main className="relative w-full h-screen flex items-center justify-center overflow-hidden">
        <div className="relative w-[1000px] h-[600px] scale-[0.8] md:scale-100 transition-transform duration-700">
          <svg viewBox="0 0 1000 600" className="absolute inset-0 w-full h-full fill-gray-900 stroke-gray-800 stroke-1 drop-shadow-2xl">
            <path d="M 180,150 Q 250,120 300,180 T 320,350 T 300,500 L 250,550 L 200,450 Q 150,300 180,150" opacity="0.5" />
            <path d="M 450,120 Q 550,100 600,150 T 650,250 L 600,350 Q 500,400 480,300 L 450,200 Z" opacity="0.5" />
            <path d="M 680,120 Q 850,100 900,150 T 920,300 T 850,400 L 750,350 Q 700,250 680,120" opacity="0.5" />
            <path d="M 850,420 Q 920,400 950,450 T 900,550 L 820,500 Z" opacity="0.5" />
          </svg>
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none mix-blend-screen" />
          {cityData.map((city) => {
            const isSelected = selectedCity?.id === city.id;
            const genreColor = GENRES[city.baseGenre].color;
            return (
              <div
                key={city.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                style={{ left: city.x, top: city.y }}
                onClick={() => handleCityClick(city)}
              >
                <div
                  className={`absolute inset-0 rounded-full opacity-40 animate-ping`}
                  style={{ backgroundColor: genreColor, animationDuration: `${60000/city.bpm}ms` }}
                ></div>
                <div
                  className={`relative w-4 h-4 rounded-full border-2 transition-all duration-300 ${isSelected ? 'scale-150 border-white shadow-[0_0_20px_rgba(255,255,255,0.8)]' : 'border-transparent hover:scale-125'}`}
                  style={{ backgroundColor: genreColor }}
                >
                  <div className={`absolute -top-12 left-1/2 -translate-x-1/2 bg-black/80 border border-gray-700 px-3 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 flex flex-col items-center gap-1`}>
                    <span className="font-bold text-white">{city.name}</span>
                    <span className="text-[10px]" style={{ color: genreColor }}>{Math.floor(city.bpm)} BPM • {city.currentMood}</span>
                  </div>
                </div>
                <div className={`absolute top-4 left-1/2 w-px h-0 bg-gradient-to-b from-white/50 to-transparent group-hover:h-8 transition-all duration-500`}></div>
              </div>
            );
          })}
        </div>
      </main>

      {/* --- LEFT PANEL: TELEMETRY (Interactive now) --- */}
      <aside className="absolute left-6 top-32 w-72 space-y-4 pointer-events-auto hidden md:block">

        {/* --- MOVED: THEME INPUT --- */}
        <NeonCard className="border-purple-500/30 bg-purple-900/10">
            <div className="flex items-center gap-2 mb-3 text-purple-400 text-xs font-bold uppercase border-b border-purple-500/20 pb-2">
                <Sliders className="w-3 h-3" />
                Vibe Controller
            </div>
            <div className="flex flex-col gap-2">
                <label className="text-[10px] text-gray-400 uppercase">Input Mood / Theme</label>
                <div className="flex items-center gap-2 bg-black/40 rounded-lg px-3 py-2 border border-purple-500/30 focus-within:border-purple-400 transition-colors">
                    <Edit3 className="w-4 h-4 text-purple-400" />
                    <input
                        type="text"
                        placeholder={selectedCity ? `e.g. "April Rain"` : "Select a city first"}
                        value={userTheme}
                        onChange={handleThemeChange}
                        disabled={!selectedCity}
                        className="bg-transparent border-none outline-none text-xs w-full text-white placeholder-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        onKeyDown={(e) => {
                             if (e.key === 'Enter') handleCityClick(selectedCity);
                        }}
                    />
                </div>
                {selectedCity && (
                     <p className="text-[9px] text-gray-500 italic text-right">Press Enter to regenerate</p>
                )}
            </div>
        </NeonCard>

        <NeonCard>
          <div className="flex items-center gap-2 mb-3 text-gray-400 text-xs font-mono uppercase border-b border-gray-800 pb-2">
            <Activity className="w-3 h-3" />
            Global Vibe Index
          </div>
          <div className="space-y-3">
            {Object.entries(GENRES).map(([key, info]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-gray-400 capitalize">{key}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${Math.random() * 80 + 10}%`,
                        backgroundColor: info.color
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </NeonCard>
      </aside>

      {/* --- RIGHT PANEL / PLAYER --- */}
      <aside className="absolute bottom-6 right-6 left-6 md:left-auto md:w-96 z-40">
        {selectedCity ? (
          <NeonCard className="bg-black/80 backdrop-blur-xl border-t border-white/20">
            {/* Player Header */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {selectedCity.name}
                </h2>
                <div className="flex items-center gap-2 text-xs mt-1">
                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/80">
                    {GENRES[selectedCity.baseGenre].label}
                  </span>
                  <span className="text-gray-400">{Math.floor(selectedCity.bpm)} BPM</span>
                  <span className="text-gray-400">• {selectedCity.currentMood}</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border border-white/10">
                  <Wind className={`w-4 h-4 ${stormActive ? 'text-purple-400 animate-spin' : 'text-gray-400'}`} />
                </div>
                {isPlaying && (
                    <Volume2 className="w-3 h-3 text-green-400 animate-pulse" />
                )}
              </div>
            </div>

            {/* AI Report / Analysis Section */}
            {aiReport && !isGenerating && (
               <div className="mb-3 p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                 <div className="flex items-center gap-2 text-[10px] text-purple-400 font-bold mb-1 uppercase tracking-wider">
                   <Sparkles className="w-3 h-3" />
                   Gemini Sonic Report
                 </div>
                 <p className="text-xs text-purple-100 italic leading-relaxed">
                   "{aiReport}"
                 </p>
               </div>
            )}

            {/* --- UPDATED: LYRICS STAGE (Removed input, focused on display) --- */}
            <div className="mb-4 bg-black/50 rounded-lg p-4 border border-gray-800 font-mono text-[10px] leading-relaxed text-gray-400 relative overflow-hidden min-h-[140px] flex flex-col justify-center items-center">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-transparent via-purple-500 to-transparent opacity-50"></div>

              {isGenerating ? (
                <div className="space-y-2 text-center">
                  <RefreshCw className="w-6 h-6 text-purple-500 animate-spin mx-auto mb-2" />
                  <p className="animate-pulse text-purple-400">&gt; Gemini is composing lyrics...</p>
                  <p className="opacity-50 text-[9px]">&gt; Matching theme to audio beat...</p>
                </div>
              ) : isPlaying && lyrics.length > 0 ? (
                <div className="flex flex-col gap-3 items-center text-center w-full">
                    <div className="text-[9px] text-purple-500 uppercase tracking-widest mb-1 flex items-center gap-1 opacity-70">
                        <Mic className="w-3 h-3" /> On Air / Lyrics
                    </div>
                    {/* Lyrics Display - Enhanced Visibility */}
                    <div className="relative w-full h-20 flex flex-col items-center justify-center perspective-1000">
                        {lyrics.map((line, idx) => {
                            // Only show current, prev, and next lines logic roughly
                            const isCurrent = idx === currentLyricIndex;
                            const isNext = idx === (currentLyricIndex + 1) % lyrics.length;
                            const isPrev = idx === (currentLyricIndex - 1 + lyrics.length) % lyrics.length;

                            if (!isCurrent && !isNext && !isPrev && lyrics.length > 3) return null;

                            return (
                                <p
                                    key={idx}
                                    className={`
                                        transition-all duration-700 ease-in-out absolute w-full px-2
                                        ${isCurrent ? 'top-1/2 -translate-y-1/2 text-white scale-110 font-bold text-sm drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] z-10' : ''}
                                        ${isNext ? 'top-[80%] opacity-40 scale-90 blur-[1px] z-0' : ''}
                                        ${isPrev ? 'top-[20%] opacity-40 scale-90 blur-[1px] z-0' : ''}
                                    `}
                                >
                                    {line}
                                </p>
                            );
                        })}
                    </div>
                </div>
              ) : (
                <div className="text-white/60 text-center flex flex-col items-center gap-2">
                   <AlignLeft className="w-6 h-6 opacity-30" />
                   <p>Awaiting Playback...</p>
                   <p className="text-[9px] opacity-50">Set a theme on the left to customize lyrics.</p>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              <button
                className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_15px_rgba(255,255,255,0.3)] disabled:opacity-50"
                disabled={isGenerating}
                onClick={handlePlayToggle}
              >
                {isGenerating ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                ) : audioLoading ? (
                  <RefreshCw className="w-5 h-5 text-purple-500 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-1" />
                )}
              </button>

              <div className="flex-1">
                {generatedTrack && (
                  <>
                     <div className="text-xs font-bold text-white mb-1 truncate">{generatedTrack.title}</div>
                     <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                       <div className={`h-full bg-gradient-to-r from-purple-500 to-blue-500 w-1/3 ${isPlaying ? 'animate-[progress_10s_linear_infinite]' : ''}`}></div>
                     </div>
                     <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                       <span>{audioLoading ? 'BUFFERING...' : '0:12'}</span>
                       <span>{generatedTrack.duration}</span>
                     </div>
                  </>
                )}
                {!generatedTrack && !isGenerating && (
                   <div className="text-xs text-gray-500 italic">Select a city to jam...</div>
                )}
              </div>
            </div>

            {/* Visualizer Bar */}
            {isPlaying && !audioLoading && (
              <div className="flex items-end justify-between h-8 mt-4 gap-0.5 opacity-80">
                {[...Array(20)].map((_, i) => (
                  <div
                    key={i}
                    className="w-full bg-purple-500 rounded-t-sm animate-pulse"
                    style={{
                      height: `${Math.random() * 80 + 20}%`,
                      animationDuration: `${0.2 + Math.random() * 0.3}s`,
                      backgroundColor: generatedTrack?.coverColor
                    }}
                  ></div>
                ))}
              </div>
            )}
          </NeonCard>
        ) : (
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-6 text-center text-gray-500 text-sm">
            <Disc className="w-8 h-8 mx-auto mb-2 opacity-50 animate-spin-slow" />
            <p>Select a city node to intercept local music frequencies.</p>
          </div>
        )}
      </aside>

      {/* Intro Overlay */}
      <div className="absolute bottom-6 left-6 pointer-events-none hidden md:block">
         <div className="text-[10px] text-gray-600 font-mono">
           <p>LAT: 34.0522 N / LNG: 118.2437 W</p>
           <p>SYSTEM STATUS: ONLINE</p>
           <p>AI MODEL: GEMINI 2.5 FLASH</p>
           <p className="mt-1 text-purple-500 font-bold">CREATED BY: AO XU</p>
         </div>
      </div>
    </div>
  );
}
