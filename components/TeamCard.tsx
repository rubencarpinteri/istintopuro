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
        relative overflow-hidden rounded-xl flex items-center justify-center transition-all duration-300
        ${compact ? 'p-2 h-14' : 'p-4 h-24'}
        ${selected ? 'ring-4 ring-white scale-105 z-10 shadow-xl' : 'hover:scale-105 opacity-80 hover:opacity-100'}
        ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
        ${className}
      `}
      style={{
        background: `linear-gradient(135deg, ${team.colors[0]} 0%, ${team.colors[1]} 100%)`
      }}
    >
      <span className={`relative z-10 text-white font-bold drop-shadow-md uppercase tracking-wider ${compact ? 'text-xs' : 'text-lg'}`}>
        {team.name}
      </span>
      {/* Glossy effect */}
      <div className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition-opacity" />
    </button>
  );
};