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
        relative flex flex-col items-center justify-center transition-none border-2
        ${compact ? 'p-1 h-16' : 'p-2 h-32'}
        ${selected 
            ? 'bg-yellow-400 border-white text-black shadow-[2px_2px_0px_0px_#fff]' 
            : 'bg-gray-800 border-gray-500 text-gray-300 hover:bg-gray-700 hover:border-gray-300 hover:text-white'
        }
        ${disabled ? 'cursor-not-allowed opacity-50 grayscale' : 'cursor-pointer'}
        ${className}
      `}
    >
      {/* Team Color Strip */}
      <div 
        className="w-full h-2 mb-2 border border-black" 
        style={{
            background: `linear-gradient(90deg, ${team.colors[0]} 50%, ${team.colors[1]} 50%)`
        }} 
      />

      <div className="flex flex-col items-center text-center w-full">
        <span className={`
            font-pixel leading-tight uppercase
            ${compact ? 'text-[8px]' : 'text-[10px]'}
        `}>
            {team.name}
        </span>
      </div>
    </button>
  );
};