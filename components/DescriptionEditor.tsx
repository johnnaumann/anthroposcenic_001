'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

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
  disabled 
}: DescriptionEditorProps) {
  const [editedDescription, setEditedDescription] = useState(description || '');

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
    <Card>
      <CardHeader>
        <CardTitle>Edit Description</CardTitle>
        <CardDescription>
          Review and edit the image description. This will be used as the prompt for image generation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={editedDescription}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Image description will appear here..."
          className="min-h-[200px] font-mono text-sm"
          disabled={disabled || !description}
        />
        
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {editedDescription ? `${editedDescription.length} characters` : 'No description'}
          </div>
          <Button
            onClick={handleNext}
            disabled={disabled || !editedDescription.trim()}
          >
            Next: Configure Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
