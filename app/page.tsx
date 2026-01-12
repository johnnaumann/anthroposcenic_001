'use client';

import { useState } from 'react';
import { ImageUploadZone } from '@/components/ImageUploadZone';
import { DescriptionStream } from '@/components/DescriptionStream';
import { ComfyUIProgress } from '@/components/ComfyUIProgress';
import { PipelineStatus } from '@/components/PipelineStatus';
import { UploadResponse } from '@/types';

export default function Home() {
  const [uploadedImage, setUploadedImage] = useState<UploadResponse | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [pipelineStep, setPipelineStep] = useState<'upload' | 'describe' | 'process' | 'complete'>('upload');
  const [error, setError] = useState<string | null>(null);

  const handleUploadComplete = (response: UploadResponse) => {
    setUploadedImage(response);
    setPipelineStep('describe');
    setError(null);
  };

  const handleDescriptionComplete = (desc: string) => {
    setDescription(desc);
    setPipelineStep('process');
    setError(null);
  };

  const handleProcessingComplete = (imageUrl: string) => {
    setResultImage(imageUrl);
    setPipelineStep('complete');
    setError(null);
  };

  const handleReset = () => {
    setUploadedImage(null);
    setDescription(null);
    setResultImage(null);
    setPipelineStep('upload');
    setError(null);
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Anthroposcenic</h1>
          <p className="text-muted-foreground">
            AI Image Processing Pipeline: Upload → Describe → Process
          </p>
        </div>

        <div className="mb-6">
          <PipelineStatus step={pipelineStep} error={error || undefined} />
        </div>

        <div className="space-y-6">
          <ImageUploadZone
            onUploadComplete={handleUploadComplete}
            disabled={pipelineStep !== 'upload'}
          />

          <DescriptionStream
            imageId={uploadedImage?.imageId || null}
            onDescriptionComplete={handleDescriptionComplete}
            disabled={pipelineStep !== 'describe'}
          />

          <ComfyUIProgress
            imageId={uploadedImage?.imageId || null}
            description={description}
            onProcessingComplete={handleProcessingComplete}
            disabled={pipelineStep !== 'process'}
          />

          {pipelineStep === 'complete' && (
            <div className="flex justify-center">
              <button
                onClick={handleReset}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Process Another Image
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
