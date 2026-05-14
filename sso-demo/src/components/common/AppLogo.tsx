import React from 'react';
import sipraOneLogo from '../../assets/sipraone-logo.png';

interface AppLogoProps {
  variant?: 'landing' | 'navbar' | 'sidebar' | 'mobile' | 'custom';
  className?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({ variant = 'navbar', className = '' }) => {
  let sizeClasses = '';
  switch (variant) {
    case 'landing':
      sizeClasses = 'h-16 lg:h-[72px] w-auto';
      break;
    case 'navbar':
      sizeClasses = 'h-14 w-auto';
      break;
    case 'sidebar':
      sizeClasses = 'h-12 w-auto';
      break;
    case 'mobile':
      sizeClasses = 'h-10 w-auto';
      break;
    case 'custom':
      sizeClasses = '';
      break;
  }

  return (
    <img
      src={sipraOneLogo}
      alt="SipraOne Logo"
      className={`object-contain shrink-0 select-none transition-all duration-200 hover:opacity-90 hover:scale-[1.02] ${sizeClasses} ${className}`.trim()}
    />
  );
};
