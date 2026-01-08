import React from 'react';
import { Team } from '../types';

interface TeamCardProps {
  team: Team;
  status: 'normal' | 'focused' | 'locked' | 'disabled';
  onClick: () => void;
  className?: string;
  compact?: boolean;
}

export const TeamCard: React.FC<TeamCardProps> = ({ team, status, onClick, className = '', compact = false }) => {
  
  // Base style for the card container
  const baseStyle = `
    relative flex flex-row items-center justify-between transition-all duration-75 border-4 w-full cursor-pointer
    overflow-hidden select-none touch-manipulation
    ${compact ? 'h-14 sm:h-16' : 'h-20'}
  `;

  // Status-specific styles
  let statusStyle = '';
  let textStyle = '';
  
  switch (status) {
    case 'locked':
      statusStyle = 'bg-yellow-900/80 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.6)] z-20 scale-[1.02]';
      textStyle = 'text-yellow-100 text-shadow-sm';
      break;
    case 'focused':
      statusStyle = 'bg-gray-800 border-green-400 shadow-[0_0_10px_rgba(74,222,128,0.4)] z-10 -translate-y-1';
      textStyle = 'text-white text-shadow';
      break;
    case 'disabled':
      statusStyle = 'bg-gray-900 border-gray-800 opacity-40 grayscale pointer-events-none';
      textStyle = 'text-gray-600';
      break;
    default: // normal
      statusStyle = 'bg-[#1a1a1a] border-gray-600 hover:border-gray-400 hover:bg-[#252525]';
      textStyle = 'text-gray-300';
      break;
  }

  return (
    <div
      onClick={onClick}
      className={`${baseStyle} ${statusStyle} ${className}`}
      role="button"
      aria-pressed={status === 'locked'}
    >
      {/* Team Color Strip (Left Side) */}
      <div 
        className="h-full w-4 sm:w-6 border-r-2 border-black/50 shrink-0" 
        style={{
            background: `linear-gradient(180deg, ${team.colors[0]} 50%, ${team.colors[1]} 50%)`
        }} 
      />

      {/* Team Name */}
      <div className="flex-1 px-3 flex flex-col justify-center items-start min-w-0">
        <span className={`
            font-pixel uppercase leading-tight truncate w-full
            ${compact ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm'}
            ${textStyle}
        `}>
            {status === 'focused' && <span className="text-green-500 mr-2 blink">{'>'}</span>}
            {team.name}
        </span>
      </div>

      {/* Retro Status Indicator (Right Side) */}
      {status === 'locked' && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 rotate-[-10deg] border-2 border-yellow-400 px-1 bg-black/80">
            <span className="font-pixel text-[8px] text-yellow-400 animate-pulse">LOCKED</span>
        </div>
      )}
      
      {/* Scanline overlay for focused/locked items */}
      {(status === 'focused' || status === 'locked') && (
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 bg-[length:100%_2px,3px_100%]"></div>
      )}
    </div>
  );
};