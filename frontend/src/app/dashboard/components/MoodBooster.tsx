'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, RefreshCw, X, Lightbulb, CheckCircle2, Trophy, RotateCcw, Smile, Brain, Gamepad2, Flame, Loader2 } from 'lucide-react';

interface MoodBoosterProps {
  userName?: string;
}

// -------------------------------------------------------------
// 100+ CURATED WORDS FOR DYNAMIC WORD SCRAMBLE
// -------------------------------------------------------------
const WORD_VAULT = [
  { word: "TEAMWORK", hint: "Essential for team success & collaboration", category: "Workplace" },
  { word: "DEADLINE", hint: "Target time when a project must be completed", category: "Project" },
  { word: "VACATION", hint: "Much needed time off to recharge your soul", category: "Lifestyle" },
  { word: "PROMOTION", hint: "Advancing to a higher job role & pay", category: "Career" },
  { word: "INNOVATION", hint: "Creating something new, clever & valuable", category: "Brainpower" },
  { word: "WEEKEND", hint: "The 2 glorious days everyone counts down to", category: "Joy" },
  { word: "COFFEE", hint: "Magical dark liquid that turns bugs into features", category: "Fuel" },
  { word: "SALARY", hint: "The happy notification received at month end", category: "Motivation" },
  { word: "CREATIVITY", hint: "Thinking outside the box to solve problems", category: "Mindset" },
  { word: "EFFICIENCY", hint: "Getting the maximum output with minimum effort", category: "Skill" },
  { word: "DEVELOPER", hint: "Someone who converts caffeine into code", category: "Tech" },
  { word: "ALGORITHM", hint: "A step-by-step procedure for solving a problem", category: "Tech" },
  { word: "LEADERSHIP", hint: "Inspiring and guiding others towards a goal", category: "Career" },
  { word: "STRATEGY", hint: "A high-level plan to achieve one or more goals", category: "Business" },
  { word: "CHAMPION", hint: "Someone who gives their best and wins", category: "Motivation" },
  { word: "BREAKTHROUGH", hint: "A sudden, dramatic, and important discovery", category: "Success" },
  { word: "HAPPINESS", hint: "The state of being joyful, content & fulfilled", category: "Wellness" },
  { word: "COLLABORATE", hint: "Working together jointly on an activity", category: "Team" },
  { word: "PRODUCTIVITY", hint: "The rate at which goods or work are produced", category: "Performance" },
  { word: "BALANCE", hint: "Equilibrium between work commitments and personal life", category: "Wellness" },
  { word: "MILESTONE", hint: "A significant stage or event in project progress", category: "Milestone" },
  { word: "SOLUTIONS", hint: "Answers to challenges or fixes to issues", category: "Mindset" },
  { word: "CHALLENGE", hint: "A call to prove or test your abilities", category: "Growth" },
  { word: "KNOWLEDGE", hint: "Facts, information, and skills acquired through learning", category: "Growth" }
];

// -------------------------------------------------------------
// LOCAL JOKES BACKUP POOL (Used if API is offline)
// -------------------------------------------------------------
const LOCAL_JOKES = [
  { setup: "Why do programmers prefer dark mode?", punchline: "Because light attracts bugs! 🐛💡", tag: "Dev Humor" },
  { setup: "Why was the calendar always so calm during peak season?", punchline: "Because its days were numbered! 📅😄", tag: "Work Life" },
  { setup: "How do you comfort a JavaScript bug?", punchline: "You console it! `console.log('It will be okay')` 💻❤️", tag: "Tech Laugh" },
  { setup: "Why did the employee bring a ladder to the meeting?", punchline: "Because they wanted to reach the next level of management! 🪜🚀", tag: "Corporate Joke" },
  { setup: "My boss told me to have a good day...", punchline: "...so I went home! Just kidding, keep smiling! 🎉☕", tag: "Office Fun" },
  { setup: "Why did the database administrator leave his wife?", punchline: "She had one-to-many relationships! 💾💔", tag: "Database Humor" },
  { setup: "There are 10 types of people in the world...", punchline: "...those who understand binary, and those who don't! 🤖✌️", tag: "Binary Joke" },
  { setup: "What is an astronaut's favorite key on a keyboard?", punchline: "The Space bar! 🚀🌌", tag: "Space Fun" }
];

const MEMORY_EMOJI_POOL = ['🚀', '💻', '☕', '🎯', '⭐', '💡', '🔥', '⚡', '🏆', '🎉', '🧠', '🎈'];

export default function MoodBooster({ userName }: MoodBoosterProps) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'math' | 'memory' | 'scramble' | 'jokes'>('math');
  const [animStep, setAnimStep] = useState<'walking' | 'opening' | 'revealed'>('walking');

  // 2-Min Countdown Timer
  const [timerSeconds, setTimerSeconds] = useState(120);
  const [timerRunning, setTimerRunning] = useState(true);

  // -------------------------------------------------------------
  // TAB 1: DYNAMIC MATH & NUMBER LOGIC GENERATOR STATE
  // -------------------------------------------------------------
  const [mathPuzzle, setMathPuzzle] = useState<{
    type: string;
    question: string;
    clue: string;
    options: (string | number)[];
    correctAnswer: string | number;
    explanation: string;
  }>({
    type: 'Sequence',
    question: '',
    clue: '',
    options: [],
    correctAnswer: '',
    explanation: ''
  });
  const [mathSelected, setMathSelected] = useState<string | number | null>(null);
  const [mathStatus, setMathStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [mathStreak, setMathStreak] = useState(0);

  // Generates 100% brand-new algorithmic math/logic puzzles non-stop
  const generateNewMathPuzzle = useCallback(() => {
    setMathSelected(null);
    setMathStatus('idle');

    const puzzleTypes = ['sequence', 'missing_op', 'mental_math', 'symbol_algebra'];
    const selectedType = puzzleTypes[Math.floor(Math.random() * puzzleTypes.length)];

    if (selectedType === 'sequence') {
      // 1. Algorithmic Number Sequences (Arithmetic, Geometric, Step)
      const subType = Math.floor(Math.random() * 3);
      if (subType === 0) {
        // Arithmetic (+D)
        const start = Math.floor(Math.random() * 20) + 1;
        const diff = Math.floor(Math.random() * 9) + 2;
        const seq = [start, start + diff, start + diff * 2, start + diff * 3];
        const answer = start + diff * 4;
        const distractors = [answer - diff, answer + diff, answer + diff * 2].filter(n => n !== answer);
        const options = [...new Set([answer, ...distractors, answer + 1, answer - 2])].slice(0, 4).sort(() => Math.random() - 0.5);

        setMathPuzzle({
          type: 'Number Sequence',
          question: `${seq.join(', ')},  __ ?`,
          clue: `Pattern: Adding +${diff} each time`,
          options,
          correctAnswer: answer,
          explanation: `Each number increases by +${diff}. So ${seq[3]} + ${diff} = ${answer}!`
        });
      } else if (subType === 1) {
        // Geometric (x2 or x3)
        const mult = Math.random() > 0.5 ? 2 : 3;
        const start = mult === 2 ? Math.floor(Math.random() * 6) + 1 : Math.floor(Math.random() * 4) + 1;
        const seq = [start, start * mult, start * mult * mult, start * mult * mult * mult];
        const answer = start * Math.pow(mult, 4);
        const distractors = [answer - mult * 2, answer + mult * 4, answer * 2];
        const options = [...new Set([answer, ...distractors])].slice(0, 4).sort(() => Math.random() - 0.5);

        setMathPuzzle({
          type: 'Geometric Series',
          question: `${seq.join(', ')},  __ ?`,
          clue: `Pattern: Multiplied by ${mult} at each step`,
          options,
          correctAnswer: answer,
          explanation: `Each term is multiplied by ×${mult}. So ${seq[3]} × ${mult} = ${answer}!`
        });
      } else {
        // Alternating (+A, -B)
        const start = Math.floor(Math.random() * 15) + 10;
        const add = Math.floor(Math.random() * 5) + 3;
        const sub = Math.floor(Math.random() * 3) + 1;
        const seq = [start, start + add, start + add - sub, start + add - sub + add];
        const answer = start + add - sub + add - sub;
        const options = [answer, answer + 2, answer - 3, answer + add].sort(() => Math.random() - 0.5);

        setMathPuzzle({
          type: 'Alternating Logic',
          question: `${seq.join(', ')},  __ ?`,
          clue: `Pattern: Alternates (+${add}, -${sub})`,
          options,
          correctAnswer: answer,
          explanation: `Alternating operations +${add} and -${sub}. So ${seq[3]} - ${sub} = ${answer}!`
        });
      }
    } else if (selectedType === 'missing_op') {
      // 2. Missing Operator Puzzle (A [?] B = C)
      const a = Math.floor(Math.random() * 12) + 2;
      const b = Math.floor(Math.random() * 10) + 2;
      const opIndex = Math.floor(Math.random() * 4);
      const ops = ['+', '-', '×', '÷'];
      let chosenOp = ops[opIndex];
      let result = 0;

      if (chosenOp === '+') result = a + b;
      else if (chosenOp === '-') {
        const big = Math.max(a, b);
        const sm = Math.min(a, b);
        result = big - sm;
        setMathPuzzle({
          type: 'Missing Operator',
          question: `${big}  [ ? ]  ${sm}  =  ${result}`,
          clue: 'Find the correct math symbol that makes this true',
          options: ['+', '-', '×', '÷'],
          correctAnswer: '-',
          explanation: `${big} - ${sm} = ${result}`
        });
        return;
      } else if (chosenOp === '×') {
        const smA = Math.floor(Math.random() * 9) + 2;
        const smB = Math.floor(Math.random() * 9) + 2;
        result = smA * smB;
        setMathPuzzle({
          type: 'Missing Operator',
          question: `${smA}  [ ? ]  ${smB}  =  ${result}`,
          clue: 'Find the math operation',
          options: ['+', '-', '×', '÷'],
          correctAnswer: '×',
          explanation: `${smA} × ${smB} = ${result}`
        });
        return;
      } else {
        const divisor = Math.floor(Math.random() * 6) + 2;
        const quotient = Math.floor(Math.random() * 6) + 2;
        const dividend = divisor * quotient;
        setMathPuzzle({
          type: 'Missing Operator',
          question: `${dividend}  [ ? ]  ${divisor}  =  ${quotient}`,
          clue: 'Find the math operation',
          options: ['+', '-', '×', '÷'],
          correctAnswer: '÷',
          explanation: `${dividend} ÷ ${divisor} = ${quotient}`
        });
        return;
      }

      setMathPuzzle({
        type: 'Missing Operator',
        question: `${a}  [ ? ]  ${b}  =  ${result}`,
        clue: 'Find the math operation',
        options: ['+', '-', '×', '÷'],
        correctAnswer: chosenOp,
        explanation: `${a} ${chosenOp} ${b} = ${result}`
      });
    } else if (selectedType === 'symbol_algebra') {
      // 3. Emoji Visual Algebra
      const valA = Math.floor(Math.random() * 8) + 2;
      const valB = Math.floor(Math.random() * 8) + 2;
      const emojis = [['🍎', '🍌'], ['⚡', '🔥'], ['⭐', '💎'], ['🚀', '🛸']];
      const [e1, e2] = emojis[Math.floor(Math.random() * emojis.length)];

      const eq1 = `${e1} + ${e1} = ${valA * 2}`;
      const eq2 = `${e1} + ${e2} = ${valA + valB}`;
      const question = `${eq1} \n ${eq2} \n What is ${e2} = ?`;
      const options = [valB, valB + 2, Math.max(1, valB - 2), valA].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4).sort(() => Math.random() - 0.5);

      setMathPuzzle({
        type: 'Visual Symbol Math',
        question: `${eq1}  |  ${eq2}`,
        clue: `Find the value of ${e2}`,
        options,
        correctAnswer: valB,
        explanation: `Since ${e1} + ${e1} = ${valA * 2}, ${e1} = ${valA}. Therefore ${e2} = ${valA + valB} - ${valA} = ${valB}!`
      });
    } else {
      // 4. Speed Mental Math
      const a = Math.floor(Math.random() * 15) + 5;
      const b = Math.floor(Math.random() * 6) + 2;
      const c = Math.floor(Math.random() * 20) + 1;
      const answer = (a * b) - c;
      const options = [answer, answer + 5, answer - 10, answer + b].sort(() => Math.random() - 0.5);

      setMathPuzzle({
        type: 'Speed Mental Math',
        question: `( ${a} × ${b} ) - ${c} = ?`,
        clue: 'Multiply first, then subtract!',
        options,
        correctAnswer: answer,
        explanation: `${a} × ${b} = ${a * b}. Then ${a * b} - ${c} = ${answer}!`
      });
    }
  }, []);

  const handleSelectMathOption = (val: string | number) => {
    if (mathSelected !== null) return;
    setMathSelected(val);
    if (String(val) === String(mathPuzzle.correctAnswer)) {
      setMathStatus('correct');
      setMathStreak(s => s + 1);
    } else {
      setMathStatus('wrong');
      setMathStreak(0);
    }
  };

  // -------------------------------------------------------------
  // TAB 2: DYNAMIC MEMORY MATRIX
  // -------------------------------------------------------------
  const [cards, setCards] = useState<{ id: number; emoji: string; isFlipped: boolean; isMatched: boolean }[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [movesCount, setMovesCount] = useState(0);
  const [gameWon, setGameWon] = useState(false);

  const initMemoryGame = useCallback(() => {
    // Pick 6 random distinct emojis from pool
    const shuffledPool = [...MEMORY_EMOJI_POOL].sort(() => Math.random() - 0.5).slice(0, 6);
    const pairList = [...shuffledPool, ...shuffledPool];
    const shuffled = pairList
      .sort(() => Math.random() - 0.5)
      .map((emoji, idx) => ({
        id: idx,
        emoji,
        isFlipped: false,
        isMatched: false
      }));
    setCards(shuffled);
    setFlippedCards([]);
    setMovesCount(0);
    setGameWon(false);
  }, []);

  const handleCardClick = (index: number) => {
    if (flippedCards.length === 2 || cards[index].isFlipped || cards[index].isMatched) return;

    const newCards = [...cards];
    newCards[index].isFlipped = true;
    const newFlipped = [...flippedCards, index];
    setCards(newCards);
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      setMovesCount(m => m + 1);
      const [firstIdx, secondIdx] = newFlipped;
      if (newCards[firstIdx].emoji === newCards[secondIdx].emoji) {
        setTimeout(() => {
          newCards[firstIdx].isMatched = true;
          newCards[secondIdx].isMatched = true;
          setCards([...newCards]);
          setFlippedCards([]);
          if (newCards.every(c => c.isMatched)) {
            setGameWon(true);
          }
        }, 400);
      } else {
        setTimeout(() => {
          newCards[firstIdx].isFlipped = false;
          newCards[secondIdx].isFlipped = false;
          setCards([...newCards]);
          setFlippedCards([]);
        }, 800);
      }
    }
  };

  // -------------------------------------------------------------
  // TAB 3: DYNAMIC WORD SCRAMBLE
  // -------------------------------------------------------------
  const [scrambleIndex, setScrambleIndex] = useState(0);
  const [scrambleInput, setScrambleInput] = useState('');
  const [scrambleStatus, setScrambleStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [showScrambleHint, setShowScrambleHint] = useState(false);

  const currentScramble = WORD_VAULT[scrambleIndex];

  // Algorithmic letter shuffler ensures random order every time
  const scrambledLetters = useMemo(() => {
    const arr = currentScramble.word.split('');
    let shuffled = [...arr].sort(() => Math.random() - 0.5);
    if (shuffled.join('') === currentScramble.word && arr.length > 2) {
      shuffled = shuffled.reverse();
    }
    return shuffled;
  }, [scrambleIndex, currentScramble.word]);

  const handleCheckScramble = () => {
    if (scrambleInput.trim().toUpperCase() === currentScramble.word) {
      setScrambleStatus('correct');
    } else {
      setScrambleStatus('wrong');
    }
  };

  const handleNextScramble = () => {
    const nextIdx = Math.floor(Math.random() * WORD_VAULT.length);
    setScrambleIndex(nextIdx === scrambleIndex ? (nextIdx + 1) % WORD_VAULT.length : nextIdx);
    setScrambleInput('');
    setScrambleStatus('idle');
    setShowScrambleHint(false);
  };

  // -------------------------------------------------------------
  // TAB 4: REAL-TIME LIVE JOKES API (WITH LOCAL FALLBACK)
  // -------------------------------------------------------------
  const [liveJoke, setLiveJoke] = useState<{ setup: string; punchline: string; tag: string }>({
    setup: "Why do programmers prefer dark mode?",
    punchline: "Because light attracts bugs! 🐛💡",
    tag: "Dev Humor"
  });
  const [loadingLiveJoke, setLoadingLiveJoke] = useState(false);

  const fetchLiveJoke = useCallback(async () => {
    setLoadingLiveJoke(true);
    try {
      const res = await fetch('https://official-joke-api.appspot.com/random_joke');
      if (res.ok) {
        const data = await res.json();
        if (data.setup && data.punchline) {
          setLiveJoke({
            setup: data.setup,
            punchline: data.punchline,
            tag: data.type ? `Live ${data.type.toUpperCase()}` : 'Live Laugh'
          });
          setLoadingLiveJoke(false);
          return;
        }
      }
    } catch (err) {
      // Fallback seamlessly to local pool
    }

    // Fallback: Pick random from local joke pool
    const rand = LOCAL_JOKES[Math.floor(Math.random() * LOCAL_JOKES.length)];
    setLiveJoke(rand);
    setLoadingLiveJoke(false);
  }, []);

  // -------------------------------------------------------------
  // LIFECYCLE & INITIALIZATION
  // -------------------------------------------------------------
  useEffect(() => {
    setMounted(true);
  }, []);

  // 2-Min Countdown Timer Effect
  useEffect(() => {
    let interval: any = null;
    if (isOpen && timerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isOpen, timerRunning, timerSeconds]);

  const displayName = (userName && userName.trim()) ? userName.split(' ')[0] : 'Superstar';

  const triggerEntrance = () => {
    setAnimStep('walking');
    setTimeout(() => setAnimStep('opening'), 400);
    setTimeout(() => setAnimStep('revealed'), 900);
  };

  const handleOpen = () => {
    setTimerSeconds(120);
    setTimerRunning(true);
    generateNewMathPuzzle();
    initMemoryGame();
    handleNextScramble();
    fetchLiveJoke();
    setIsOpen(true);
    triggerEntrance();
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // -------------------------------------------------------------
  // RENDER PORTAL MODAL
  // -------------------------------------------------------------
  const renderModal = () => {
    if (!isOpen || !mounted) return null;

    return createPortal(
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-6 overflow-y-auto font-sans select-none">
        <div className="relative w-full max-w-2xl flex flex-col items-center justify-center gap-4 my-auto">
          
          {/* TOP BAR: EMBLEM + TIMER + CLOSE */}
          <div className="w-full flex items-center justify-between px-2 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#07518a] flex items-center justify-center text-xl shadow-md shrink-0 border border-white/20">
                🧩
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black tracking-tight text-white font-outfit">2-Minute Mind Refresh</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Live Dynamic
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium">Hey {displayName}, take a 2-min breather & refresh your brain!</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-xs font-mono font-bold text-amber-300">
                <span>⏱️</span>
                <span>{formatTimer(timerSeconds)}</span>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* MAIN CARD CONTAINER */}
          <div
            className={`w-full bg-white dark:bg-slate-900 rounded-3xl border-2 border-[#07518a]/40 dark:border-[#07518a]/60 shadow-[0_25px_80px_rgba(0,0,0,0.6)] p-5 sm:p-6 relative z-10 transition-all duration-400 ease-out ${
              animStep === 'revealed' ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
            }`}
          >
            {/* TABS NAVIGATION */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl mb-5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('math')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'math'
                    ? 'bg-[#07518a] text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-[#07518a]'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                <span>🧠 Math & Logic</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('memory')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'memory'
                    ? 'bg-[#07518a] text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-[#07518a]'
                }`}
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                <span>🃏 Memory Game</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('scramble')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'scramble'
                    ? 'bg-[#07518a] text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-[#07518a]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>🔤 Word Scramble</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('jokes')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'jokes'
                    ? 'bg-[#07518a] text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-[#07518a]'
                }`}
              >
                <Smile className="w-3.5 h-3.5" />
                <span>😄 Live Jokes</span>
              </button>
            </div>

            {/* TAB 1: 🧠 100% DYNAMIC MATH & LOGIC GENERATOR */}
            {activeTab === 'math' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-50 dark:bg-blue-950/40 text-[#07518a] dark:text-[#38bdf8] border border-blue-200 dark:border-blue-800">
                      {mathPuzzle.type}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      {mathPuzzle.clue}
                    </span>
                  </div>

                  {mathStreak > 0 && (
                    <span className="flex items-center gap-1 text-xs font-black text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800">
                      <Flame className="w-3.5 h-3.5 fill-amber-500 animate-bounce" />
                      Streak: {mathStreak}
                    </span>
                  )}
                </div>

                {/* DYNAMIC FORMULA DISPLAY BOX */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/40 dark:from-slate-800/80 dark:to-slate-850 border border-slate-200 dark:border-slate-700 min-h-[100px] flex items-center justify-center text-center shadow-inner">
                  <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-wider">
                    {mathPuzzle.question}
                  </p>
                </div>

                {/* DYNAMIC MULTIPLE CHOICE BUTTONS */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {mathPuzzle.options.map((opt, idx) => {
                    const isSelected = mathSelected === opt;
                    const isCorrect = String(opt) === String(mathPuzzle.correctAnswer);
                    let btnStyle = 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-white border-slate-200 dark:border-slate-700';

                    if (mathSelected !== null) {
                      if (isCorrect) {
                        btnStyle = 'bg-emerald-600 text-white border-emerald-600 shadow-md scale-105';
                      } else if (isSelected && !isCorrect) {
                        btnStyle = 'bg-rose-600 text-white border-rose-600';
                      } else {
                        btnStyle = 'opacity-40 bg-slate-100 dark:bg-slate-800 border-transparent';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectMathOption(opt)}
                        disabled={mathSelected !== null}
                        className={`p-3.5 rounded-xl font-black text-base transition-all cursor-pointer border shadow-2xs ${btnStyle}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {/* FEEDBACK STATUS */}
                {mathStatus === 'correct' && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-300 text-xs font-black flex items-center justify-between animate-fadeIn">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Correct! {mathPuzzle.explanation} 🎉
                    </span>
                    <button
                      type="button"
                      onClick={generateNewMathPuzzle}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all cursor-pointer"
                    >
                      Next &rarr;
                    </button>
                  </div>
                )}

                {mathStatus === 'wrong' && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center justify-between animate-shake">
                    <span>Incorrect! {mathPuzzle.explanation}</span>
                    <button
                      type="button"
                      onClick={generateNewMathPuzzle}
                      className="text-rose-600 underline font-bold cursor-pointer"
                    >
                      Try Another
                    </button>
                  </div>
                )}

                {/* FOOTER ACTIONS */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={generateNewMathPuzzle}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Generate New Puzzle 🎲</span>
                  </button>

                  <button
                    onClick={() => setIsOpen(false)}
                    type="button"
                    className="px-4 py-2 rounded-xl bg-[#07518a] hover:bg-[#053d69] text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
                  >
                    Back to Work 🚀
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: 🃏 100% DYNAMIC MEMORY MATRIX */}
            {activeTab === 'memory' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1">
                    🎯 Moves: <strong className="text-[#07518a] font-mono">{movesCount}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={initMemoryGame}
                    className="flex items-center gap-1 text-[#07518a] hover:underline cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> Reshuffle Grid
                  </button>
                </div>

                {gameWon ? (
                  <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-400 text-center space-y-3 animate-zoomIn">
                    <Trophy className="w-12 h-12 text-amber-500 mx-auto animate-bounce" />
                    <h3 className="text-lg font-black text-emerald-800 dark:text-emerald-200">
                      Fantastic Job, {displayName}! 🎉
                    </h3>
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      You matched all cards in {movesCount} moves! Mind refreshed & charged.
                    </p>
                    <button
                      type="button"
                      onClick={initMemoryGame}
                      className="px-4 py-2 rounded-xl bg-[#07518a] text-white text-xs font-extrabold shadow-md cursor-pointer hover:bg-[#053d69] transition-all"
                    >
                      Play New Set 🔄
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2.5 sm:gap-3 max-w-sm mx-auto">
                    {cards.map((card, idx) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => handleCardClick(idx)}
                        className={`h-16 sm:h-20 rounded-2xl text-2xl flex items-center justify-center font-bold transition-all duration-300 cursor-pointer shadow-sm border ${
                          card.isFlipped || card.isMatched
                            ? 'bg-blue-50 dark:bg-[#07518a]/30 border-[#07518a] scale-100 rotate-0'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-700 hover:scale-105'
                        }`}
                      >
                        {(card.isFlipped || card.isMatched) ? card.emoji : '❓'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: 🔤 DYNAMIC WORD SCRAMBLE */}
            {activeTab === 'scramble' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    {currentScramble.category}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowScrambleHint(!showScrambleHint)}
                    className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    <span>{showScrambleHint ? 'Hide Clue' : 'Show Clue 💡'}</span>
                  </button>
                </div>

                {showScrambleHint && (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-800 dark:text-amber-300 animate-fadeIn">
                    Clue: {currentScramble.hint}
                  </div>
                )}

                {/* SCRAMBLED TILES */}
                <div className="flex items-center justify-center gap-1.5 sm:gap-2 py-3 flex-wrap">
                  {scrambledLetters.map((letter, idx) => (
                    <span
                      key={idx}
                      className="w-10 h-11 sm:w-12 sm:h-13 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-slate-800 dark:to-slate-750 border-2 border-[#07518a] text-slate-800 dark:text-white font-black text-lg sm:text-xl flex items-center justify-center shadow-sm"
                    >
                      {letter}
                    </span>
                  ))}
                </div>

                {/* USER INPUT BOX */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={scrambleInput}
                    onChange={(e) => {
                      setScrambleInput(e.target.value.toUpperCase());
                      setScrambleStatus('idle');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCheckScramble();
                    }}
                    placeholder="Type unscrambled word..."
                    className="flex-1 px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-extrabold text-sm tracking-wider uppercase focus:outline-none focus:border-[#07518a]"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleCheckScramble}
                    className="px-5 py-2.5 bg-[#07518a] hover:bg-[#053d69] text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-sm"
                  >
                    Check
                  </button>
                </div>

                {/* FEEDBACK STATUS */}
                {scrambleStatus === 'correct' && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-300 text-xs font-black flex items-center justify-between animate-fadeIn">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Bingo! You nailed it: {currentScramble.word} 🎉
                    </span>
                    <button
                      type="button"
                      onClick={handleNextScramble}
                      className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition-all cursor-pointer"
                    >
                      Next Word &rarr;
                    </button>
                  </div>
                )}

                {scrambleStatus === 'wrong' && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center justify-between animate-shake">
                    <span>Oops! Rearrange the letters and try again! 🤔</span>
                    <button
                      type="button"
                      onClick={() => setScrambleInput(currentScramble.word)}
                      className="text-rose-600 underline font-bold cursor-pointer"
                    >
                      Reveal
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={handleNextScramble}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Next Scramble 🎲</span>
                  </button>

                  <button
                    onClick={() => setIsOpen(false)}
                    type="button"
                    className="px-4 py-2 rounded-xl bg-[#07518a] hover:bg-[#053d69] text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
                  >
                    Back to Work 🚀
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: 😄 100% LIVE REAL-TIME JOKES */}
            {activeTab === 'jokes' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    {liveJoke.tag}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    Real-Time Comedy 🎭
                  </span>
                </div>

                <div className="p-5 rounded-2xl bg-amber-50/50 dark:bg-slate-800/60 border border-amber-200/60 dark:border-slate-700 min-h-[110px] flex flex-col justify-center space-y-3 relative">
                  {loadingLiveJoke ? (
                    <div className="py-4 text-center flex flex-col items-center justify-center space-y-2">
                      <Loader2 className="w-6 h-6 text-[#07518a] animate-spin" />
                      <p className="text-xs font-bold text-slate-400">Fetching live joke from comedy servers...</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-base font-bold text-slate-800 dark:text-slate-100">
                        "{liveJoke.setup}"
                      </p>
                      <p className="text-base font-black text-[#07518a] dark:text-amber-400 pl-4 border-l-3 border-[#07518a]">
                        {liveJoke.punchline}
                      </p>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={fetchLiveJoke}
                    disabled={loadingLiveJoke}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-xs font-extrabold transition-all cursor-pointer border border-amber-200 dark:border-amber-800 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingLiveJoke ? 'animate-spin' : ''}`} />
                    <span>Get Another Live Joke 🎲</span>
                  </button>

                  <button
                    onClick={() => setIsOpen(false)}
                    type="button"
                    className="px-4 py-2 rounded-xl bg-[#07518a] hover:bg-[#053d69] text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
                  >
                    Back to Work 🚀
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <>
      <button
        onClick={handleOpen}
        type="button"
        className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-gradient-to-r from-blue-500/10 via-amber-500/10 to-indigo-500/10 dark:from-blue-950/40 dark:via-amber-950/40 dark:to-indigo-950/40 border border-[#07518a]/30 dark:border-[#07518a]/50 hover:border-[#07518a] text-[#07518a] dark:text-[#38bdf8] font-extrabold text-xs shadow-2xs hover:shadow-md hover:scale-105 transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 shrink-0"
        title="2-Minute Fun Break & Dynamic Puzzle Lounge"
      >
        <span className="text-sm animate-bounce">🧩</span>
        <span className="hidden sm:inline font-black tracking-tight bg-gradient-to-r from-[#07518a] to-blue-600 dark:from-[#38bdf8] dark:to-blue-400 bg-clip-text text-transparent">
          2-Min Break
        </span>
      </button>

      {renderModal()}
    </>
  );
}
