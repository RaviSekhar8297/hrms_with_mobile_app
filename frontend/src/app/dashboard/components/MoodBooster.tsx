'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, RefreshCw, X, Coffee, Smile, Heart, Droplets, Zap, Trophy, Gift } from 'lucide-react';

interface MoodBoosterProps {
  userName?: string;
}

interface MoodItem {
  category: 'HUMOR' | 'CHAI' | 'ENCOURAGEMENT' | 'HEALTH' | 'CALM' | 'WIN';
  icon: React.ReactNode;
  badge: string;
  badgeColor: string;
  title: string;
  message: string;
  subtext?: string;
  giftTag: string;
}

export default function MoodBooster({ userName }: MoodBoosterProps) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  // Animation state steps: 'walking' -> 'opening' -> 'revealed'
  const [animStep, setAnimStep] = useState<'walking' | 'opening' | 'revealed'>('walking');
  const [isShuffling, setIsShuffling] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const displayName = (userName && userName.trim()) ? userName.split(' ')[0] : 'Superstar';

  const MOOD_ITEMS: MoodItem[] = [
    {
      category: 'HUMOR',
      icon: <Smile className="w-4 h-4 text-amber-500" />,
      badge: 'Office Humor',
      badgeColor: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/60',
      title: `Hey ${displayName}!`,
      message: "If at first you don't succeed, call it version 1.0! Don't stress over bugs today — even coffee takes a few minutes to brew.",
      subtext: "Code works on local? That's 90% of the victory!",
      giftTag: " Surprise Joke 🎁"
    },
    {
      category: 'CHAI',
      icon: <Coffee className="w-4 h-4 text-orange-500" />,
      badge: 'Chai & Coffee Break',
      badgeColor: 'bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/60',
      title: 'Time for a 5-Min Break!',
      message: `You've been working hard like a superhero, ${displayName}. Step away, grab a warm cup of Tea or Coffee, and refresh your mind!`,
      subtext: 'A 5-minute break increases productivity by 200%.',
      giftTag: ' Chai Voucher ☕'
    },
    {
      category: 'ENCOURAGEMENT',
      icon: <Heart className="w-4 h-4 text-rose-500" />,
      badge: 'You Are Awesome',
      badgeColor: 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/60',
      title: `You're Doing Amazing, ${displayName}!`,
      message: 'Remember: You have survived 100% of your hardest workdays so far. Today is just another milestone in your success story!',
      subtext: 'Small consistent daily progress creates giant results.',
      giftTag: ' Badge of Honor ⭐'
    },
    {
      category: 'HEALTH',
      icon: <Droplets className="w-4 h-4 text-blue-500" />,
      badge: 'Hydration Check',
      badgeColor: 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/60',
      title: 'Water Break Time!',
      message: `Hey ${displayName}, your brain is 75% water! Go drink a full glass of water right now and do a quick 10-second shoulder stretch.`,
      subtext: 'Hydrated minds code & manage 2x faster.',
      giftTag: ' Health Boost 💧'
    },
    {
      category: 'CALM',
      icon: <Zap className="w-4 h-4 text-purple-500" />,
      badge: '10-Sec Micro Reset',
      badgeColor: 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/60',
      title: 'Deep Breath In... Out...',
      message: `Close your eyes for 5 seconds, ${displayName}. Inhale deeply... Hold... Exhale. Feel the calm washing over your mind.`,
      subtext: '10 seconds of conscious calm resets your whole focus.',
      giftTag: ' Peace Gift 🌿'
    },
    {
      category: 'WIN',
      icon: <Trophy className="w-4 h-4 text-emerald-500" />,
      badge: 'Daily Motivation',
      badgeColor: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60',
      title: 'Keep Going, Superstar!',
      message: `Every single task you check off today brings you closer to your big goals. Smile, take a breath, and conquer the rest of the day!`,
      subtext: 'Payday is coming and your efforts really matter!',
      giftTag: ' Trophy Gift 🏆'
    }
  ];

  const triggerAnimationSequence = () => {
    setAnimStep('walking');
    
    // Step 1: Mascot walks in from right (0 -> 800ms)
    setTimeout(() => {
      setAnimStep('opening');
    }, 800);

    // Step 2: Mascot opens gift box with magic effect (800ms -> 1500ms)
    setTimeout(() => {
      setAnimStep('revealed');
    }, 1500);
  };

  const handleOpen = () => {
    const rand = Math.floor(Math.random() * MOOD_ITEMS.length);
    setCurrentIndex(rand);
    setIsOpen(true);
    triggerAnimationSequence();
  };

  const handleShuffle = () => {
    setIsShuffling(true);
    setCurrentIndex((prev) => (prev + 1) % MOOD_ITEMS.length);
    triggerAnimationSequence();
    setTimeout(() => {
      setIsShuffling(false);
    }, 1500);
  };

  const current = MOOD_ITEMS[currentIndex];

  const renderModal = () => {
    if (!isOpen || !mounted) return null;

    return createPortal(
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/60 backdrop-blur-[3px] p-4 sm:p-6 overflow-hidden font-sans select-none">
        
        {/* Main Gift & Popup Card Container */}
        <div className="relative w-full max-w-2xl flex flex-col md:flex-row items-center justify-center gap-6">
          
          {/* 🏃‍♂️ MASCOT CHARACTER (Walks in from right side of screen) */}
          <div
            className={`transition-all duration-700 ease-out flex flex-col items-center justify-center shrink-0 z-20 ${
              animStep === 'walking'
                ? 'translate-x-[80vw] opacity-0 scale-75'
                : animStep === 'opening'
                ? 'translate-x-0 opacity-100 scale-110 animate-bounce'
                : 'translate-x-0 opacity-100 scale-100'
            }`}
          >
            {/* Gift Tag Floating Above Mascot */}
            <div className={`transition-all duration-300 -mb-2 z-30 ${animStep === 'revealed' ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
              <span className="px-3 py-1 rounded-full bg-rose-500 text-white font-semibold text-xs uppercase shadow-md flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5" />
                <span>{current.giftTag}</span>
              </span>
            </div>

            {/* 3D Mascot Character Image */}
            <div className="relative w-44 h-44 sm:w-56 sm:h-56 filter drop-shadow-[0_20px_35px_rgba(245,158,11,0.4)]">
              {/* Magic Aura when opening gift box */}
              {animStep === 'opening' && (
                <div className="absolute inset-0 bg-amber-400/40 rounded-full blur-2xl animate-ping" />
              )}
              
              <img
                src="/mascot-gift.png"
                alt="Mascot Walking & Presenting Gift"
                className={`w-full h-full object-contain transition-transform duration-500 ${
                  animStep === 'opening' ? 'scale-110 rotate-3' : 'scale-100 rotate-0'
                }`}
              />
            </div>

            <span className="text-xs font-semibold text-amber-300 uppercase tracking-[0.08em] bg-slate-900/85 px-3.5 py-1 rounded-full border border-amber-500/30 shadow-md -mt-2">
              {animStep === 'walking' ? 'Walking In... 🚶' : animStep === 'opening' ? 'Opening Gift... 🎁✨' : 'Buddy Gift Opened! 🎁'}
            </span>
          </div>

          {/* 💬 POPUP CARD (Erupts/Expands OUT OF the Gift Box after it opens) */}
          <div
            className={`w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-amber-300/70 dark:border-amber-500/25 shadow-[0_24px_64px_-16px_rgba(16,24,40,0.55)] p-6 sm:p-7 relative z-10 transition-all duration-500 ease-out origin-left ${
              animStep === 'revealed'
                ? 'scale-100 opacity-100 translate-x-0'
                : 'scale-0 opacity-0 -translate-x-12'
            }`}
          >
            {/* Ambient Background Glows inside Card */}
            <div className="absolute -top-16 -right-16 w-40 h-40 bg-amber-400/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Header Bar */}
            <div className="flex items-center justify-between relative z-10 border-b border-[#eaecf0] dark:border-white/[0.06] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-[0.04em] border ${current.badgeColor}`}>
                  {current.icon}
                  <span>{current.badge}</span>
                </span>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="space-y-4 relative z-10">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-[-0.01em] flex items-center gap-2 font-outfit">
                <span>{current.title}</span>
                <Sparkles className="w-4.5 h-4.5 text-amber-500 animate-spin-slow shrink-0" />
              </h3>

              <p className="text-sm font-normal text-slate-600 dark:text-slate-300 leading-relaxed">
                "{current.message}"
              </p>

              {current.subtext && (
                <div className="pt-2 border-t border-[#eaecf0] dark:border-white/[0.06] flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <span>💡</span>
                  <span>{current.subtext}</span>
                </div>
              )}
            </div>

            {/* Footer Action Buttons */}
            <div className="flex items-center justify-between pt-5 mt-5 border-t border-[#eaecf0] dark:border-white/[0.06] relative z-10 gap-2">
              <button
                onClick={handleShuffle}
                disabled={isShuffling || animStep !== 'revealed'}
                type="button"
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-[10px] bg-amber-500/10 hover:bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-semibold transition-colors cursor-pointer border border-amber-500/20 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isShuffling ? 'animate-spin' : ''}`} />
                <span>Cheer Me Again! 🎲</span>
              </button>

              <button
                onClick={() => setIsOpen(false)}
                type="button"
                className="px-5 py-2.5 rounded-[10px] bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors cursor-pointer active:scale-95 border-0"
              >
                I'm Energized! 🚀
              </button>
            </div>

          </div>

        </div>

      </div>,
      document.body
    );
  };

  return (
    <>
      {/* 🎈 MOOD BOOSTER TRIGGER BUTTON (Placed next to Ctrl K Search) */}
      <button
        onClick={handleOpen}
        type="button"
        className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-[#e4e7ec] dark:border-white/[0.08] text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 shrink-0"
        title="Mood Booster & Instant Cheer Up"
      >
        <Sparkles className="w-4 h-4 text-amber-500" />
        <span className="hidden sm:inline font-medium text-xs">
          Cheer
        </span>
      </button>

      {renderModal()}
    </>
  );
}

