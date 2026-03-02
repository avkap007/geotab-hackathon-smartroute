import React from "react";

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

export const TruckIcon: React.FC<IconProps> = ({ size = 24, color = "currentColor", className }) =>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="1" y="7" width="13" height="10" rx="2.5" fill={color} />
    <rect x="3" y="9" width="4" height="3" rx="1" fill="white" opacity="0.45" />
    <path d="M14 11h3.5l3.5 4v2.5a1.5 1.5 0 01-1.5 1.5H14V11z" fill={color} opacity="0.8" />
    <rect x="16" y="12" width="2.5" height="2" rx="0.5" fill="white" opacity="0.4" />
    <circle cx="6" cy="18.5" r="2" fill={color} stroke="white" strokeWidth="1.5" />
    <circle cx="18" cy="18.5" r="2" fill={color} stroke="white" strokeWidth="1.5" />
  </svg>;


export const ClockIcon: React.FC<IconProps> = ({ size = 24, color = "currentColor", className }) =>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="12" cy="12" r="9.5" fill={color} opacity="0.12" />
    <circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth="1.8" fill="none" />
    <path d="M12 7v5.5l3.5 2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="1.2" fill={color} />
  </svg>;


export const FuelIcon: React.FC<IconProps> = ({ size = 24, color = "currentColor", className }) =>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="4" y="4" width="10" height="16" rx="2.5" fill={color} opacity="0.15" />
    <rect x="4" y="4" width="10" height="16" rx="2.5" stroke={color} strokeWidth="1.8" fill="none" />
    <rect x="6.5" y="7" width="5" height="4" rx="1" fill={color} opacity="0.35" />
    <path d="M14 8h2a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V13" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="15.5" cy="6" r="1" fill={color} />
  </svg>;


export const LeafIcon: React.FC<IconProps> = ({ size = 24, color = "currentColor", className }) =>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="">
    <path d="M6 20c0 0 1-9 6-13s9-3 9-3-1 9-6 13-9 3-9 3z" fill={color} opacity="0.18" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M8 18c2-3 5-6 10-9" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
  </svg>;


export const SkipIcon: React.FC<IconProps> = ({ size = 24, color = "currentColor", className }) =>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M5 12h10" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M12 5l7 7-7 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="19" y1="5" x2="19" y2="19" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>;


export const PinIcon: React.FC<IconProps> = ({ size = 24, color = "currentColor", className }) =>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill={color} opacity="0.2" stroke={color} strokeWidth="1.8" />
    <circle cx="12" cy="9" r="2.5" fill={color} />
  </svg>;


export const CalendarIcon: React.FC<IconProps> = ({ size = 24, color = "currentColor", className }) =>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="3" y="4" width="18" height="17" rx="2.5" stroke={color} strokeWidth="1.8" fill="none" />
    <rect x="3" y="4" width="18" height="17" rx="2.5" fill={color} opacity="0.08" />
    <line x1="8" y1="2" x2="8" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <line x1="16" y1="2" x2="16" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <line x1="3" y1="10" x2="21" y2="10" stroke={color} strokeWidth="1.5" opacity="0.3" />
    <circle cx="8" cy="14" r="1.2" fill={color} opacity="0.5" />
    <circle cx="12" cy="14" r="1.2" fill={color} opacity="0.5" />
    <circle cx="16" cy="14" r="1.2" fill={color} opacity="0.5" />
  </svg>;


export const SearchIcon: React.FC<IconProps> = ({ size = 24, color = "currentColor", className }) =>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="10.5" cy="10.5" r="6.5" stroke={color} strokeWidth="2" fill={color} opacity="0.06" />
    <line x1="15.5" y1="15.5" x2="21" y2="21" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
  </svg>;


export const CheckIcon: React.FC<IconProps> = ({ size = 24, color = "currentColor", className }) =>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="12" cy="12" r="10" fill={color} opacity="0.15" />
    <path d="M7 12.5l3.5 3.5L17 9" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;


export const CloseIcon: React.FC<IconProps> = ({ size = 24, color = "currentColor", className }) =>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <line x1="7" y1="7" x2="17" y2="17" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <line x1="17" y1="7" x2="7" y2="17" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>;


export const SpinnerIcon: React.FC<IconProps> = ({ size = 24, color = "currentColor", className }) =>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`animate-spin ${className ?? ""}`}>
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" opacity="0.2" />
    <path d="M12 2a10 10 0 019.8 8" stroke={color} strokeWidth="3" strokeLinecap="round" />
  </svg>;


/** Cute bin illustration — use as a React component for popups, slider, etc. */
export const BinCharacter: React.FC<{
  fillLevel: number;
  meetsThreshold: boolean;
  size?: number;
}> = ({ fillLevel, meetsThreshold, size = 48 }) => {
  // Soft, lovable palette
  const bodyColor = meetsThreshold ? "#F97B8B" : "#7EC8E3";
  const lidColor = meetsThreshold ? "#E8616F" : "#5BA8C8";
  const liquidColor = meetsThreshold ? "#FBBFC7" : "#B5E8D5";
  const cheekColor = meetsThreshold ? "#FDD" : "#D4F0FF";
  const sparkleColor = meetsThreshold ? "#FFD57E" : "#C9B6FF";
  const fillH = fillLevel / 100 * 18;
  const fillY = 38 - fillH;

  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 44 50">
      {/* Soft shadow */}
      <ellipse cx="22" cy="48" rx="12" ry="2.2" fill="#c4b5fd" opacity="0.18" />
      {/* Body — chubby rounded */}
      <rect x="8" y="16" width="28" height="26" rx="10" fill={bodyColor} />
      {/* Body highlight */}
      <rect x="11" y="18" width="10" height="6" rx="4" fill="white" opacity="0.18" />
      {/* Liquid inside */}
      {fillH > 0 &&
      <rect x="11" y={fillY} width="22" height={fillH + 2} rx="6" fill={liquidColor} opacity="0.55" />
      }
      {/* Lid — soft rounded */}
      <rect x="6" y="11" width="32" height="7" rx="3.5" fill={lidColor} />
      {/* Lid handle */}
      <rect x="17" y="5.5" width="10" height="7.5" rx="4" fill={lidColor} />
      {/* Lid highlight */}
      <rect x="19" y="7.5" width="6" height="2.2" rx="1.1" fill="white" opacity="0.3" />
      {/* Eyes — big sparkly */}
      <ellipse cx="16.5" cy="27" rx="3.8" ry="4" fill="white" />
      <ellipse cx="27.5" cy="27" rx="3.8" ry="4" fill="white" />
      <circle cx="16.5" cy="27.8" r="2.2" fill="#2d2b42" />
      <circle cx="27.5" cy="27.8" r="2.2" fill="#2d2b42" />
      {/* Eye sparkles — two per eye for extra cute */}
      <circle cx="15.2" cy="26.3" r="1.1" fill="white" />
      <circle cx="17.2" cy="28.5" r="0.5" fill="white" opacity="0.7" />
      <circle cx="26.2" cy="26.3" r="1.1" fill="white" />
      <circle cx="28.2" cy="28.5" r="0.5" fill="white" opacity="0.7" />
      {/* Rosy cheeks */}
      <ellipse cx="11.5" cy="31.5" rx="3" ry="1.8" fill={cheekColor} opacity="0.6" />
      <ellipse cx="32.5" cy="31.5" rx="3" ry="1.8" fill={cheekColor} opacity="0.6" />
      {/* Sparkle accent — pop of color */}
      <circle cx="35" cy="14" r="1.5" fill={sparkleColor} opacity="0.7" />
      <circle cx="37" cy="18" r="0.8" fill={sparkleColor} opacity="0.5" />
      {/* Happy smile */}
      <path d="M17.5 34 Q22 38 26.5 34" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>);

};