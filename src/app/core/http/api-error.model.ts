/** Single shape for every HTTP error, once it has gone through the interceptor. */
export interface ApiError {
  /** HTTP status; 0 when the server could not be reached. */
  status: number;
  message: string;
  /** Message per field, as returned by the backend validation. Empty when none. */
  fieldErrors: Record<string, string>;
}
