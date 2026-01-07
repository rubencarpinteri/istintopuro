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
  const baseStyles = "px-4 py-3 font-pixel text-xs uppercase tracking-widest transition-none transform active:translate-y-1 active:shadow-none border-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-blue-700 text-white border-white shadow-[4px_4px_0px_0px_#000] hover:bg-blue-600",
    secondary: "bg-gray-200 text-black border-black shadow-[4px_4px_0px_0px_#000] hover:bg-white",
    danger: "bg-red-600 text-white border-white shadow-[4px_4px_0px_0px_#000] hover:bg-red-500",
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