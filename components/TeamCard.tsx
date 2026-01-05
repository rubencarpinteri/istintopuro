import React from 'react';
import { Team } from '../types';

interface TeamCardProps {
  team: Team;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export const TeamCard: React.FC<TeamCardProps> = ({ team, selected, onClick, disabled }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative overflow-hidden rounded-xl p-4 h-24 flex items-center justify-center transition-all duration-300
        ${selected ? 'ring-4 ring-white scale-105' : 'hover:scale-105 opacity-80 hover:opacity-100'}
        ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
      `}
      style={{
        background: `linear-gradient(135deg, ${team.colors[0]} 0%, ${team.colors[1]} 100%)`
      }}
    >
      <span className="relative z-10 text-white font-bold text-lg drop-shadow-md uppercase tracking-wider">
        {team.name}
      </span>
      {/* Glossy effect */}
      <div className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition-opacity" />
    </button>
  );
};