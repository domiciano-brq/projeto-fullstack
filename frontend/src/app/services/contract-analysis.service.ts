import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AnalyzeQueuedResponse {
  analysisId: string;
  status: 'queued';
  cached: false;
}

export interface AnalyzeCachedResponse {
  analysisId: string;
  status: 'completed';
  cached: true;
  result: AnalysisResult;
}

export type AnalyzeResponse = AnalyzeQueuedResponse | AnalyzeCachedResponse;

export interface AnalysisClause {
  clauseIndex: number;
  text: string;
  riskLevel: 'alto' | 'medio' | 'baixo';
  explanation: string;
}

export interface AnalysisResult {
  summary: string;
  clauses: AnalysisClause[];
  embeddingsSaved: boolean;
  processedAt: string;
}

export interface AnalysisStatusInProgress {
  analysisId: string;
  status: 'queued' | 'processing';
  progress: number;
}

export interface AnalysisStatusCompleted {
  analysisId: string;
  status: 'completed';
  cached: boolean;
  result: AnalysisResult;
}

export interface AnalysisStatusFailed {
  analysisId: string;
  status: 'failed';
  error: string;
}

export type AnalysisStatusResponse =
  | AnalysisStatusInProgress
  | AnalysisStatusCompleted
  | AnalysisStatusFailed;

export interface SearchResult {
  analysisId: string;
  fileName: string;
  similarity: number;
  summary: string;
  analyzedAt: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class ContractAnalysisService {
  private readonly baseUrl: string;

  constructor(private http: HttpClient) {
    this.baseUrl = environment.apiUrl;
  }

  analyzeContract(file: File): Observable<AnalyzeResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<AnalyzeResponse>(
      `${this.baseUrl}/api/contracts/analyze`,
      formData
    );
  }

  getAnalysisStatus(analysisId: string): Observable<AnalysisStatusResponse> {
    return this.http.get<AnalysisStatusResponse>(
      `${this.baseUrl}/api/contracts/analyze/${analysisId}`
    );
  }

  searchContracts(query: string, limit = 10): Observable<SearchResponse> {
    const params = new HttpParams()
      .set('q', query)
      .set('limit', limit.toString());
    return this.http.get<SearchResponse>(
      `${this.baseUrl}/api/contracts/search`,
      { params }
    );
  }
}
