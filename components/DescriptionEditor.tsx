'use client';

import { useState, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

interface DescriptionEditorProps {
  description: string | null;
  onDescriptionChange: (description: string) => void;
  onNext: () => void;
  disabled?: boolean;
}

export function DescriptionEditor({
  description,
  onDescriptionChange,
  onNext,
  disabled,
}: DescriptionEditorProps) {
  const [editedDescription, setEditedDescription] = useState(description || '');

  useEffect(() => {
    if (description) {
      setEditedDescription(description);
    }
  }, [description]);

  const handleChange = (value: string) => {
    setEditedDescription(value);
    onDescriptionChange(value);
  };

  const handleNext = () => {
    if (editedDescription.trim()) {
      onNext();
    }
  };

  return (
    <div className="space-y-4">
      <Textarea
        value={editedDescription}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="The prompt will appear here…"
        className="min-h-[240px] font-mono text-[13px] leading-relaxed"
        disabled={disabled || !description}
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {editedDescription ? `${editedDescription.length} characters` : 'No prompt'}
        </span>
        <Button onClick={handleNext} disabled={disabled || !editedDescription.trim()}>
          Continue
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
