'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ComfyUIConfigOptions } from '@/types';
import {
  applyConfigDefaultsFromOptions,
  ConfigFormValues,
  INITIAL_CONFIG_FORM,
} from '@/lib/config-selector';

export function useConfigSelectorForm() {
  const [configOptions, setConfigOptions] = useState<ComfyUIConfigOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [values, setValues] = useState<ConfigFormValues>(INITIAL_CONFIG_FORM);

  const setField = <K extends keyof ConfigFormValues>(key: K, value: ConfigFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/comfyui/config');
        if (!response.ok) {
          throw new Error('Failed to fetch configuration options');
        }

        const data = (await response.json()) as ComfyUIConfigOptions;
        setConfigOptions(data);
        setValues((current) => ({ ...current, ...applyConfigDefaultsFromOptions(data) }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load configuration';
        toast.error(message);
        setLoadFailed(true);
      } finally {
        setLoading(false);
      }
    };

    void fetchConfig();
  }, []);

  return {
    configOptions,
    loading,
    loadFailed,
    values,
    setField,
  };
}
