/** Single shape for every HTTP error, once it has gone through the interceptor. */
export interface ApiError {
  message: string;
  /** Message per field, as returned by the backend validation. Empty when none. */
  fieldErrors: Record<string, string>;
}
