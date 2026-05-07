import {
  Shield, Target, Brain, Zap, Sword, Book, Flame, Eye, Cpu,
  Heart, Star, Trophy, Sparkles, Swords,
} from "lucide-react";

export const skillIconMap = {
  shield: Shield,
  target: Target,
  brain: Brain,
  zap: Zap,
  sword: Sword,
  swords: Swords,
  book: Book,
  flame: Flame,
  eye: Eye,
  cpu: Cpu,
  heart: Heart,
  star: Star,
  trophy: Trophy,
  sparkles: Sparkles,
};

export function getSkillIcon(name) {
  const key = (name || "").toLowerCase();
  return skillIconMap[key] || Sparkles;
}
