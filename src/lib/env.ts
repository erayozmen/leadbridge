type PublicSupabaseEnvName =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

type PublicAppEnvName = "NEXT_PUBLIC_APP_URL";

type SupabaseEnv = Readonly<{
  url: string;
  publishableKey: string;
}>;

type ServerDatabaseEnvName = "DATABASE_URL" | "DIRECT_URL";
type ServerAuthEnvName = "SUPABASE_SERVICE_ROLE_KEY";

function readRequiredPublicEnv(name: PublicSupabaseEnvName): string {
  const value = process.env[name];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readRequiredAppEnv(name: PublicAppEnvName): string {
  const value = process.env[name];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readRequiredServerEnv(name: ServerDatabaseEnvName): string {
  if (typeof window !== "undefined") {
    throw new Error(`${name} can only be read on the server`);
  }

  const value = process.env[name];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }

  return value;
}

function readRequiredAuthEnv(name: ServerAuthEnvName): string {
  if (typeof window !== "undefined") {
    throw new Error("AUTH_ADMIN_NOT_CONFIGURED");
  }
  const value = process.env[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("AUTH_ADMIN_NOT_CONFIGURED");
  }
  return value;
}

function readSupabaseUrl(): string {
  const value = readRequiredPublicEnv("NEXT_PUBLIC_SUPABASE_URL");

  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("invalid protocol");
    }
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must be a valid HTTP or HTTPS URL",
    );
  }

  return value;
}

export function getSupabaseEnv(): SupabaseEnv {
  return {
    url: readSupabaseUrl(),
    publishableKey: readRequiredPublicEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ),
  };
}

export function getPublicAppUrl(): string {
  const value = readRequiredAppEnv("NEXT_PUBLIC_APP_URL");

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    return url.origin;
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL must be a valid HTTP or HTTPS URL");
  }
}

export function getDatabaseUrl(): string {
  return readRequiredServerEnv("DATABASE_URL");
}

export function getDirectDatabaseUrl(): string {
  return readRequiredServerEnv("DIRECT_URL");
}

export function getSupabaseAdminEnv() {
  return {
    url: readSupabaseUrl(),
    serviceRoleKey: readRequiredAuthEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}
