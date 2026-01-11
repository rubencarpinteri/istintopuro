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
}

const Key: React.FC<KeyProps> = ({ char, onClick, wide = false, variant = 'default', disabled }) => {
  let bgColor = 'bg-gray-700 text-white active:bg-gray-600';
  let height = 'h-12 sm:h-14'; 
  
  if (variant === 'action') {
    bgColor = 'bg-gray-600 text-gray-200 active:bg-gray-500';
  } else if (variant === 'confirm') {
    bgColor = 'bg-green-600 text-white active:bg-green-500 border-b-4 border-green-800 active:border-b-0 active:translate-y-[4px] shadow-none';
    height = 'h-12 sm:h-14';
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
        ${wide ? 'flex-[1.5] text-xs sm:text-sm' : 'flex-1 text-sm sm:text-lg'}
        ${height}
        mx-0.5 sm:mx-1 rounded
        font-bold 
        ${variant !== 'confirm' ? 'shadow-[0_3px_0_0_rgba(0,0,0,0.4)] active:shadow-none active:translate-y-[3px]' : ''}
        transition-all touch-manipulation select-none
        flex items-center justify-center
        ${bgColor}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
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
    <div className="w-full bg-[#151530] p-2 pt-3 select-none border-t border-gray-800 pb-12 sm:pb-4">
      <div className="max-w-xl mx-auto flex flex-col gap-2">
        {/* Row 1 */}
        <div className="flex w-full">
          {row1.map(char => <Key key={char} char={char} onClick={() => onChar(char)} disabled={disabled} />)}
        </div>
        
        {/* Row 2: Indented, Delete at end */}
        <div className="flex w-full">
            <div className="flex-[0.5]" />
            {row2.map(char => <Key key={char} char={char} onClick={() => onChar(char)} disabled={disabled} />)}
            <Key char="⌫" wide variant="action" onClick={onDelete} disabled={disabled} />
        </div>

        {/* Row 3: More Indented, Enter at end */}
        <div className="flex w-full">
            <div className="flex-[1.5]" />
            {row3.map(char => <Key key={char} char={char} onClick={() => onChar(char)} disabled={disabled} />)}
            <Key char="ENTER" wide variant="confirm" onClick={onEnter} disabled={disabled} />
        </div>
      </div>
    </div>
  );
};