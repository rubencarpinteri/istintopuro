import React from 'react';
import { Team } from '../types';

interface TeamCardProps {
  team: Team;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}

export const TeamCard: React.FC<TeamCardProps> = ({ team, selected, onClick, disabled, className = '', compact = false }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative flex flex-col items-center justify-start transition-all border-2 w-full
        ${compact ? 'p-1.5 h-16 sm:h-20' : 'p-4 h-32'}
        ${selected 
            ? 'bg-yellow-400 border-white text-black scale-105 z-10 shadow-[0_0_15px_rgba(255,255,255,0.3)]' 
            : 'bg-[#1a1a1a] border-gray-700 text-gray-400 hover:bg-[#252525] hover:border-gray-500 hover:text-white'
        }
        ${disabled ? 'cursor-not-allowed opacity-40 grayscale' : 'cursor-pointer active:scale-95'}
        ${className}
      `}
    >
      {/* Team Color Strip */}
      <div 
        className="w-full h-2 mb-1.5 border border-black/50 shadow-inner shrink-0" 
        style={{
            background: `linear-gradient(90deg, ${team.colors[0]} 50%, ${team.colors[1]} 50%)`
        }} 
      />

      <div className="flex items-center justify-center w-full flex-1 min-w-0">
        <span className={`
            font-pixel leading-none uppercase text-center whitespace-nowrap overflow-hidden text-ellipsis w-full
            ${compact ? 'text-[9px] sm:text-[10px]' : 'text-xs'}
        `}>
            {team.name}
        </span>
      </div>
    </button>
  );
};