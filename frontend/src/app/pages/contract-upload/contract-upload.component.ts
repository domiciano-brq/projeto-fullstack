import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  ContractAnalysisService,
  AnalyzeCachedResponse
} from '../../services/contract-analysis.service';

type UploadState = 'idle' | 'uploading' | 'error';

@Component({
  selector: 'app-contract-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './contract-upload.component.html',
  styleUrl: './contract-upload.component.css'
})
export class ContractUploadComponent {
  uploadState = signal<UploadState>('idle');
  errorMessage = signal<string>('');
  selectedFile = signal<File | null>(null);
  isDragOver = signal<boolean>(false);

  readonly acceptedTypes = ['application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'];
  readonly maxSizeMb = 50;

  constructor(
    private service: ContractAnalysisService,
    private router: Router
  ) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  private handleFile(file: File): void {
    this.errorMessage.set('');
    if (!this.acceptedTypes.includes(file.type)) {
      this.errorMessage.set('Tipo de arquivo invalido. Envie PDF, DOCX ou TXT.');
      return;
    }
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > this.maxSizeMb) {
      this.errorMessage.set('Arquivo excede o limite de 50 MB.');
      return;
    }
    this.selectedFile.set(file);
  }

  removeFile(): void {
    this.selectedFile.set(null);
    this.errorMessage.set('');
    this.uploadState.set('idle');
  }

  uploadContract(): void {
    const file = this.selectedFile();
    if (!file) {
      this.errorMessage.set('Nenhum arquivo selecionado.');
      return;
    }
    this.uploadState.set('uploading');
    this.errorMessage.set('');

    this.service.analyzeContract(file).subscribe({
      next: (response) => {
        if (response.status === 'completed' && response.cached) {
          const cached = response as AnalyzeCachedResponse;
          this.router.navigate(['/analysis', cached.analysisId], {
            state: { result: cached.result, cached: true }
          });
        } else {
          this.router.navigate(['/analysis', response.analysisId]);
        }
      },
      error: (err) => {
        this.uploadState.set('error');
        const msg = err?.error?.error ?? 'Erro ao enviar contrato. Tente novamente.';
        this.errorMessage.set(msg);
      }
    });
  }

  get fileSizeMb(): string {
    const file = this.selectedFile();
    if (!file) return '';
    return (file.size / (1024 * 1024)).toFixed(2);
  }

  get fileExtension(): string {
    const file = this.selectedFile();
    if (!file) return '';
    return file.name.split('.').pop()?.toUpperCase() ?? '';
  }
}
