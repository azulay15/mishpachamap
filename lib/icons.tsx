/**
 * MMIcon — adapter that maps the handoff's icon-name vocabulary onto lucide-react.
 * The handoff JSX uses tokens like "search", "kid", "garden", "sparkle" — we keep
 * those names in the component API and translate to lucide here so screens stay
 * identical to the spec.
 */
import {
  Search, X, ChevronDown, ChevronLeft, ChevronRight, Check, Plus, Minus,
  Filter, Layers, Map, MapPin, Heart, Star, Share2, Settings, User, Users,
  School, Baby, Trees, Leaf, ShoppingCart, Bus, UsersRound, Tag, Home,
  GitCompare, Send, Sparkles, Zap, Info, List, Grid, Calendar, TrendingUp,
  Ruler, Bed, Sprout, Car, ArrowLeft, ExternalLink, Globe, Menu, MoreHorizontal,
  Bell, Shield, WheatOff, GripVertical, Navigation, ScrollText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  search: Search,
  x: X,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  check: Check,
  plus: Plus,
  minus: Minus,
  filter: Filter,
  layers: Layers,
  map: Map,
  pin: MapPin,
  heart: Heart,
  "heart-fill": Heart,
  star: Star,
  "star-fill": Star,
  share: Share2,
  settings: Settings,
  user: User,
  users: Users,
  school: School,
  kid: Baby,
  tree: Trees,
  leaf: Leaf,
  cart: ShoppingCart,
  bus: Bus,
  people: UsersRound,
  tag: Tag,
  home: Home,
  compare: GitCompare,
  send: Send,
  sparkle: Sparkles,
  zap: Zap,
  info: Info,
  list: List,
  grid: Grid,
  calendar: Calendar,
  "trend-up": TrendingUp,
  ruler: Ruler,
  bed: Bed,
  garden: Sprout,
  car: Car,
  back: ArrowLeft,
  external: ExternalLink,
  globe: Globe,
  menu: Menu,
  more: MoreHorizontal,
  bell: Bell,
  shield: Shield,
  gluten: WheatOff,
  drag: GripVertical,
  directions: Navigation,
  scroll: ScrollText,
};

type Props = {
  name: string;
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
};

export function MMIcon({ name, size = 18, color = "currentColor", className, style }: Props) {
  const Cmp = MAP[name];
  if (!Cmp) return null;
  const fill = name.endsWith("-fill") ? color : "none";
  return (
    <Cmp
      size={size}
      color={color}
      strokeWidth={1.5}
      fill={fill}
      className={className}
      style={{ flex: "none", ...style }}
      aria-hidden
    />
  );
}
