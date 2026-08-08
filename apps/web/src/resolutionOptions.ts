import type { Resolution } from './types';

export const resolutionOptions: Array<{ value: Resolution; label: string; detail: string; aspect: 'landscape' | 'square' | 'portrait' | 'feed' }> = [
  { value: '480p', label: 'SD', detail: '854 × 480', aspect: 'landscape' },
  { value: '720p', label: 'HD', detail: '1280 × 720', aspect: 'landscape' },
  { value: '1080p', label: 'Full HD', detail: '1920 × 1080', aspect: 'landscape' },
  { value: '1440p', label: '2K', detail: '2560 × 1440', aspect: 'landscape' },
  { value: '4k', label: '4K', detail: '3840 × 2160', aspect: 'landscape' },
  { value: 'square-720', label: 'Square HD', detail: '720 × 720', aspect: 'square' },
  { value: 'square', label: 'Square', detail: '1080 × 1080', aspect: 'square' },
  { value: 'portrait-720', label: 'Vertical HD', detail: '720 × 1280', aspect: 'portrait' },
  { value: 'portrait', label: 'Story', detail: '1080 × 1920', aspect: 'portrait' },
  { value: 'feed-portrait', label: 'Feed 4:5', detail: '1080 × 1350', aspect: 'feed' },
];

export const resolutionAspect = (resolution: Resolution) => resolutionOptions.find((option) => option.value === resolution)?.aspect ?? 'landscape';
