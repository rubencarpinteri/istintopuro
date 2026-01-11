import React from 'react';

interface VirtualKeyboardProps {
  onChar: (char: string) => void;
  onDelete: () => void;
  onEnter: () => void;
  disabled?: boolean;
}

interface KeyProps {
  char: string | React.ReactNode;
  onClick: () => void;
  wide?: boolean;
  variant?: 'default' | 'action' | 'confirm';
  disabled?: boolean;
  className?: string;
}

const Key: React.FC<KeyProps> = ({ char, onClick, wide = false, variant = 'default', disabled, className = '' }) => {
  let bgColor = 'bg-gray-700 text-white active:bg-gray-600';
  let height = 'h-11 sm:h-14'; // Slightly shorter on mobile to fit vertical space
  
  if (variant === 'action') {
    bgColor = 'bg-red-900/80 border-red-700 text-white active:bg-red-800'; // Red tint for delete
  } else if (variant === 'confirm') {
    bgColor = 'bg-green-700 text-white active:bg-green-600 border-b-4 border-green-900 active:border-b-0 active:translate-y-[4px] shadow-none';
    height = 'h-11 sm:h-14';
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      disabled={disabled}
      type="button"
      className={`
        ${wide ? 'flex-[1.5]' : 'flex-1'}
        ${height}
        min-w-0
        mx-[1px] sm:mx-0.5 rounded
        text-sm sm:text-lg font-bold 
        ${variant !== 'confirm' ? 'shadow-[0_2px_0_0_rgba(0,0,0,0.4)] active:shadow-none active:translate-y-[2px]' : ''}
        transition-all touch-manipulation select-none
        flex items-center justify-center
        ${bgColor}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      {char}
    </button>
  );
};

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({ onChar, onDelete, onEnter, disabled }) => {
  const row1 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
  const row2 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'];
  const row3 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M'];

  return (
    <div className="w-full bg-[#151530] p-1 pt-2 select-none border-t border-gray-800 pb-8 sm:pb-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-1.5 sm:gap-2 px-1">
        
        {/* Row 1: Letters + Delete */}
        <div className="flex w-full">
          {row1.map(char => <Key key={char} char={char} onClick={() => onChar(char)} disabled={disabled} />)}
          <Key char="⌫" onClick={onDelete} variant="action" disabled={disabled} className="text-xs sm:text-sm" />
        </div>
        
        {/* Row 2: Letters + Enter */}
        <div className="flex w-full pl-[5%]"> {/* Slight indentation for visual stagger */}
            {row2.map(char => <Key key={char} char={char} onClick={() => onChar(char)} disabled={disabled} />)}
            <Key char="↵" wide onClick={onEnter} variant="confirm" disabled={disabled} />
        </div>

        {/* Row 3: Letters Centered */}
        <div className="flex w-full px-[15%]">
            {row3.map(char => <Key key={char} char={char} onClick={() => onChar(char)} disabled={disabled} />)}
        </div>
      </div>
    </div>
  );
};