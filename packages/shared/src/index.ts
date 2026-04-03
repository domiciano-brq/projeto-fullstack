// Shared types and utilities for ContractIQ
// Add shared types, constants, and utility functions here

export interface ApiResponse<T> {
  data: T;
  error?: string;
}
