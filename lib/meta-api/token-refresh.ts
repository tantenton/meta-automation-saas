// Token refresh handler
import { getLongLivedToken, refreshToken } from './auth';

/**
 * Check if token is expired or expiring soon (within 24 hours)
 */
export function isTokenExpiring(accessToken: string, expiryTime: string): boolean {
  const now = new Date();
  const expiry = new Date(expiryTime);
  const diffHours = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
  return diffHours < 24;
}

/**
 * Refresh token if needed
 */
export async function refreshAccessToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string
): Promise<{ accessToken: string; expiryTime: string }> {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('meta_access_token, meta_refresh_token, meta_token_expiry')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    throw new Error('User not found or error fetching user');
  }

  // Check if token needs refresh
  if (user.meta_token_expiry && isTokenExpiring(user.meta_access_token, user.meta_token_expiry)) {
    if (!user.meta_refresh_token) {
      throw new Error('No refresh token available');
    }

    try {
      const newTokens = await refreshToken(user.meta_refresh_token);
      
      // Update database with new tokens
      const { error: updateError } = await supabase
        .from('users')
        .update({
          meta_access_token: newTokens.accessToken,
          meta_token_expiry: new Date(Date.now() + newTokens.expiresIn * 1000).toISOString(),
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Failed to update token in DB:', updateError);
      }

      return {
        accessToken: newTokens.accessToken,
        expiryTime: new Date(Date.now() + newTokens.expiresIn * 1000).toISOString(),
      };
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Fallback to short-lived token
      return {
        accessToken: user.meta_access_token,
        expiryTime: user.meta_token_expiry || new Date(Date.now() + 1000 * 60 * 60).toISOString(),
      };
    }
  }

  return {
    accessToken: user.meta_access_token,
    expiryTime: user.meta_token_expiry || new Date(Date.now() + 1000 * 60 * 60).toISOString(),
  };
}

/**
 * Exchange short-lived code for long-lived token
 */
export async function exchangeAndSaveToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  code: string
): Promise<{ accessToken: string; expiryTime: string }> {
  // Exchange code for short-lived token
  const shortLived = await getLongLivedToken(code);

  // Save to database
  const expiryDate = new Date(Date.now() + shortLived.expiresIn * 1000);

  const { error } = await supabase
    .from('users')
    .upsert({
      id: userId,
      meta_access_token: shortLived.accessToken,
      meta_token_expiry: expiryDate.toISOString(),
    })
    .select();

  if (error) throw error;

  return {
    accessToken: shortLived.accessToken,
    expiryTime: expiryDate.toISOString(),
  };
}
