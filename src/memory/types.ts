export type MemoryType = 'fact' | 'episode' | 'procedure' | 'semantic';

export interface MemoryEntry {
  id: string;
  namespace: string;
  content: string;
  summary?: string;
  memoryType: MemoryType;
  source?: string;
  importance: number;
  tags: string[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface MemoryQuery {
  query: string;
  namespace?: string;
  includeShared?: boolean;
  memoryType?: MemoryType;
  minImportance?: number;
  limit?: number;
  tags?: string[];
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  similarity: number;
}

export interface StoreOptions {
  memoryType: MemoryType;
  source?: string;
  importance?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
}
