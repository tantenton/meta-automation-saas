import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { generateOAuthUrl, exchangeCodeForToken, getLongLivedToken, getMetaUser, getInstagramAccount } from '@/lib/meta-api/auth';

// Generate state for OAuth
function generateState(): string {
  return Math.random().toString(36).substring(2, 15);
}

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Meta',
      credentials: {
        code: { label: 'Code', type: 'text' },
        state: { label: 'State', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.code) return null;

        try {
          const tokens = await exchangeCodeForToken(credentials.code);
          const user = await getMetaUser(tokens.accessToken);

          // Get Instagram account if available
          const instagramAccount = await getInstagramAccount(tokens.accessToken, user.id);

          // Placeholder user object - will be saved to Supabase in real implementation
          return {
            id: `user_${user.id}`,
            name: user.name,
            email: user.email,
            picture: user.picture?.data?.url,
            accessToken: tokens.accessToken,
          };
        } catch (error) {
          console.error('Meta OAuth error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.accessToken = user.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    signOut: '/logout',
    error: '/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
