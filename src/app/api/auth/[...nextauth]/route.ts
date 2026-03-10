import NextAuth, { type NextAuthOptions } from "next-auth";
import type { OAuthConfig, OAuthUserConfig } from "next-auth/providers";

type CanvasProfile = {
  id: number;
  name?: string | null;
  sortable_name?: string | null;
  short_name?: string | null;
  primary_email?: string | null;
};

function CanvasProvider(
  options: OAuthUserConfig<CanvasProfile> & { canvasBaseUrl: string },
): OAuthConfig<CanvasProfile> {
  const baseUrl = options.canvasBaseUrl.replace(/\/+$/, "");

  return {
    id: "canvas",
    name: "Canvas",
    type: "oauth",
    authorization: {
      url: `${baseUrl}/login/oauth2/auth`,
      params: {
        scope:
          process.env.CANVAS_SCOPES ??
          "url:GET|/api/v1/users/self/profile url:GET|/api/v1/users/self/todo",
      },
    },
    token: `${baseUrl}/login/oauth2/token`,
    userinfo: `${baseUrl}/api/v1/users/self/profile`,
    profile(profile) {
      return {
        id: String(profile.id),
        name: profile.name ?? profile.short_name ?? profile.sortable_name ?? null,
        email: profile.primary_email ?? null,
      };
    },
    options,
  };
}

export const authOptions: NextAuthOptions = {
  providers: [
    CanvasProvider({
      clientId: process.env.CANVAS_CLIENT_ID ?? "",
      clientSecret: process.env.CANVAS_CLIENT_SECRET ?? "",
      canvasBaseUrl: process.env.CANVAS_BASE_URL ?? "https://csumb.instructure.com",
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      if (account?.provider === "canvas") {
        token.canvasAccessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      (session as typeof session & { canvasAccessToken?: string }).canvasAccessToken =
        typeof token.canvasAccessToken === "string" ? token.canvasAccessToken : undefined;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

