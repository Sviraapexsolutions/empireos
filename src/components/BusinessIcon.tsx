import {
  Briefcase,
  Building2,
  Cpu,
  Fuel,
  Globe,
  Megaphone,
  Shield,
  Store,
  User,
  Zap,
} from 'lucide-react';
import type { BusinessIconKey } from '../types/empire';

export const BUSINESS_ICON_OPTIONS: Array<{ key: BusinessIconKey; label: string }> = [
  { key: 'fuel', label: 'Fuel' },
  { key: 'megaphone', label: 'Marketing' },
  { key: 'cpu', label: 'Tech' },
  { key: 'building', label: 'Industrial' },
  { key: 'store', label: 'Retail' },
  { key: 'user', label: 'Personal' },
  { key: 'briefcase', label: 'Holdings' },
  { key: 'shield', label: 'Capital' },
  { key: 'globe', label: 'Global' },
  { key: 'zap', label: 'Energy' },
];

export function BusinessIcon({
  icon,
  className = 'w-4 h-4',
  color,
}: {
  icon: BusinessIconKey;
  className?: string;
  color?: string;
}) {
  const style = color ? { color } : undefined;
  switch (icon) {
    case 'fuel':
      return <Fuel className={className} style={style} />;
    case 'megaphone':
      return <Megaphone className={className} style={style} />;
    case 'cpu':
      return <Cpu className={className} style={style} />;
    case 'building':
      return <Building2 className={className} style={style} />;
    case 'store':
      return <Store className={className} style={style} />;
    case 'user':
      return <User className={className} style={style} />;
    case 'briefcase':
      return <Briefcase className={className} style={style} />;
    case 'shield':
      return <Shield className={className} style={style} />;
    case 'globe':
      return <Globe className={className} style={style} />;
    case 'zap':
    default:
      return <Zap className={className} style={style} />;
  }
}
