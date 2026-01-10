import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  ...props 
}) => {
  // Bigger, chunkier, retro buttons with 8px hard shadow
  const baseStyles = "px-6 py-4 font-pixel text-sm uppercase tracking-widest transition-none transform active:translate-y-2 active:shadow-none border-4 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-blue-700 text-white border-white shadow-[8px_8px_0px_0px_#000] hover:bg-blue-600",
    secondary: "bg-gray-200 text-black border-black shadow-[8px_8px_0px_0px_#000] hover:bg-white",
    danger: "bg-red-600 text-white border-white shadow-[8px_8px_0px_0px_#000] hover:bg-red-500",
    ghost: "bg-transparent text-gray-300 hover:text-white border-transparent hover:border-gray-500 hover:bg-gray-800"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};