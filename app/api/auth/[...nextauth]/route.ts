import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { generateOAuthUrl, exchangeCodeForToken, getLongLivedToken, getMetaUser, getInstagramAccount } from '@/lib/meta-api/auth';
import { SupabaseClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = new SupabaseClient(supabaseUrl, supabaseAnonKey);

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

          // Save or update user in Supabase
          const { data: existingUser, error: findError } = await supabase
            .from('users')
            .select('*')
            .eq('meta_id', user.id)
            .single();

          let userId = existingUser?.id;

          if (!userId) {
            // Create new user
            const { data: newUser, error: insertError } = await supabase
              .from('users')
              .insert({
                meta_id: user.id,
                name: user.name,
                email: user.email,
                picture: user.picture?.data?.url,
                meta_access_token: tokens.accessToken,
                meta_token_expiry: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
                meta_refresh_token: tokens.accessToken,
              })
              .select()
              .single();

            if (insertError) throw insertError;
            userId = newUser.id;
          } else {
            // Update existing user
            await supabase
              .from('users')
              .update({
                meta_access_token: tokens.accessToken,
                meta_token_expiry: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
                name: user.name,
                email: user.email,
                picture: user.picture?.data?.url,
              })
              .eq('id', userId);
          }

          // If Instagram account available, save or update it
          if (instagramAccount) {
            const { error: igError } = await supabase
              .from('social_accounts')
              .upsert({
                user_id: userId,
                platform: 'instagram',
                platform_user_id: instagramAccount.id,
                username: instagramAccount.username,
                access_token: tokens.accessToken,
                token_expiry: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
              })
              .eq('user_id', userId)
              .eq('platform', 'instagram');

            if (igError) console.error('Failed to save Instagram account:', igError);
          }

          return {
            id: userId,
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
