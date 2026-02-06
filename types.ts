export enum Status {
  Backlog = 'Backlog',
  InProgress = 'In Progress',
  Review = 'Review',
  Completed = 'Completed'
}

export enum Priority {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High'
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  dueDate: string; // ISO Date string
  tags: string[];
  createdAt: number;
  // New Time Tracking Fields
  timeSpent: number; // in minutes
  isTiming: boolean;
  lastStartedAt?: number;
  completedAt?: number;
}

export type ChatMode = 'assistant' | 'explorer' | 'artist' | 'blitz';

export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export interface GroundingChunk {
  web?: { uri: string; title: string };
  maps?: { 
    uri: string; 
    title: string;
    placeAnswerSources?: { reviewSnippets?: { url: string }[] }[] 
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isError?: boolean;
  image?: string; // Base64 string for generated images
  grounding?: GroundingChunk[]; // For map/web links
  mode?: ChatMode;
}

export interface Slide {
  id: string;
  title: string;
  content: string[]; // Bullet points
}

export interface Note {
  id: string;
  title: string;
  content: string; // Raw markdown
  slides?: Slide[]; // Generated slides
  isCanvasMode: boolean;
  lastModified: number;
}
