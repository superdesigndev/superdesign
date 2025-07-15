import React from 'react';
import {
  ZoomIn,
  ZoomOut,
  Home,
  Maximize2,
  RotateCcw,
  Globe,
  Smartphone,
  Tablet,
  Monitor,
  Wrench,
  Clock,
  Check,
  Lightbulb,
  Folder,
  AlertTriangle,
  CheckSquare,
  List,
  Link,
  Settings,
  Brain,
  Trash2,
  MessageCircle,
  Edit2,
  Share2,
  Code2,
  MoreHorizontal
} from 'lucide-react';

const iconStyle: React.CSSProperties = {
    width: '18px',
    height: '18px',
};

const toolIconStyle: React.CSSProperties = {
    width: '14px',
    height: '14px',
};

const selectorIconStyle: React.CSSProperties = {
    width: '12px',
    height: '12px',
};

// Canvas Control Icons
export const ZoomInIcon = () => <ZoomIn style={iconStyle} />;
export const ZoomOutIcon = () => <ZoomOut style={iconStyle} />;
export const HomeIcon = () => <Home style={iconStyle} />;
export const ScaleIcon = () => <Maximize2 style={iconStyle} />;
export const RefreshIcon = () => <RotateCcw style={iconStyle} />;
export const SettingsIcon = () => <Settings style={iconStyle} />;

// Viewport Icons
export const GlobeIcon = () => <Globe style={iconStyle} />;
export const MobileIcon = () => <Smartphone style={iconStyle} />;
export const TabletIcon = () => <Tablet style={iconStyle} />;
export const DesktopIcon = () => <Monitor style={iconStyle} />;

// Layout Icons
export const TreeIcon = () => <List style={iconStyle} />;
export const LinkIcon = () => <Link style={iconStyle} />;

// Tool Icons (smaller size)
export const ToolIcon = () => <Wrench style={toolIconStyle} />;
export const ClockIcon = () => <Clock style={toolIconStyle} />;
export const CheckIcon = () => <Check style={toolIconStyle} />;
export const LightBulbIcon = () => <Lightbulb style={toolIconStyle} />;
export const GroupIcon = () => <Folder style={toolIconStyle} />;
export const WarningIcon = () => <AlertTriangle style={toolIconStyle} />;
export const TaskIcon = () => <CheckSquare style={toolIconStyle} />;
export const TrashIcon = () => <Trash2 style={toolIconStyle} />;
export const CommentIcon = () => <MessageCircle style={toolIconStyle} />;
export const EditIcon = () => <Edit2 style={toolIconStyle} />;
export const ShareIcon = () => <Share2 style={toolIconStyle} />;
export const CodeIcon = () => <Code2 style={toolIconStyle} />;
export const MoreIcon = () => <MoreHorizontal style={toolIconStyle} />;

// Selector Icons (smallest size)
export const BrainIcon = () => <Brain style={selectorIconStyle} />;