'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Switch } from '@/components/ui/switch';

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <Switch size="sm" disabled aria-label="Toggle dark mode" />;
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <Switch
      size="sm"
      checked={isDark}
      onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
      aria-label="Toggle dark mode"
    />
  );
}
