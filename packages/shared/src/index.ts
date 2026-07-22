export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiErrorBody = {
  success: false;
  statusCode: number;
  message: string | string[];
  error: string;
  path?: string;
  timestamp: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  createdAt: string;
};

export type SessionInfo = {
  id: string;
  deviceName: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastActiveAt: string;
  current: boolean;
};

export type LoginResponse = {
  user: AuthUser;
  tokens: AuthTokens;
  session: SessionInfo;
};

export type MessageResponse = {
  message: string;
};
