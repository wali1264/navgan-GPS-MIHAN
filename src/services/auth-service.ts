/**
 * Supabase Authentication & Profile Management Service
 * Supports unified login (Admin, Staff, Client), Staff self-registration with approval flow,
 * Super Admin staff approvals/suspensions, and Client onboarding with audit trails.
 */
import { supabase, supabaseNonPersist, UserProfile, DbRole, DbStatus } from '../lib/supabase';

// Helper to normalize username/phone into a Supabase Auth email format
export function normalizeAuthEmail(identifier: string): string {
  const clean = identifier.trim().toLowerCase();
  if (clean.includes('@')) {
    return clean;
  }
  // Convert username or mobile number (e.g. '0799123456' or 'hassan') into standard domain format
  const sanitized = clean.replace(/[^a-z0-9_.-]/g, '');
  return `${sanitized || 'user'}@navgan.af`;
}

export class AuthService {
  /**
   * Universal Login for Super Admin, Staff, and Clients
   */
  public async signIn(identifier: string, password: string): Promise<{
    profile: UserProfile | null;
    error: string | null;
  }> {
    try {
      const email = normalizeAuthEmail(identifier);
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authErr || !authData.user) {
        // Also try searching username in public.profiles first in case custom email was stored
        const { data: profileByUsername } = await supabase
          .from('profiles')
          .select('*')
          .or(`username.ilike.${identifier.trim()},phone.eq.${identifier.trim()},email.ilike.${identifier.trim()}`)
          .maybeSingle();

        if (profileByUsername?.email) {
          const { data: retryAuth, error: retryErr } = await supabase.auth.signInWithPassword({
            email: profileByUsername.email,
            password,
          });

          if (!retryErr && retryAuth.user) {
            return { profile: profileByUsername as UserProfile, error: null };
          }
        }

        return {
          profile: null,
          error: authErr?.message?.includes('Invalid login credentials')
            ? 'نام کاربری یا رمز عبور اشتباه است'
            : (authErr?.message || 'خطا در برقراری ارتباط با سرور احراز هویت'),
        };
      }

      // Fetch corresponding profile
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profErr || !profile) {
        // Fallback profile if record hasn't been created yet
        const fallbackProfile: UserProfile = {
          id: authData.user.id,
          username: identifier.trim(),
          full_name: authData.user.user_metadata?.full_name || identifier.trim(),
          email: authData.user.email,
          phone: authData.user.user_metadata?.phone || '',
          role: (authData.user.user_metadata?.role as DbRole) || 'client',
          status: 'approved',
          created_at: authData.user.created_at,
          updated_at: authData.user.created_at,
        };
        return { profile: fallbackProfile, error: null };
      }

      return { profile: profile as UserProfile, error: null };
    } catch (err: any) {
      return { profile: null, error: err.message || 'خطای پیش‌بینی نشده در ورود' };
    }
  }

  /**
   * Staff and Administrator Registration (Hidden form for internal operators/admins)
   */
  public async registerStaffOrAdmin(params: {
    username: string;
    fullName: string;
    phone: string;
    email?: string;
    password: string;
    role: 'super_admin' | 'staff';
    notes?: string;
  }): Promise<{ profile: UserProfile | null; error: string | null }> {
    try {
      const email = params.email?.trim() ? params.email.trim() : normalizeAuthEmail(params.username);
      
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password: params.password,
        options: {
          data: {
            username: params.username.trim(),
            full_name: params.fullName.trim(),
            phone: params.phone.trim(),
            role: params.role,
            notes: params.notes || '',
          },
        },
      });

      if (authErr || !authData.user) {
        return {
          profile: null,
          error: authErr?.message?.includes('User already registered')
            ? 'این نام کاربری یا ایمیل قبلاً ثبت شده است'
            : (authErr?.message || 'خطا در ثبت نام پرسنل'),
        };
      }

      // Upsert profile record explicitly to ensure consistency
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          username: params.username.trim(),
          full_name: params.fullName.trim(),
          phone: params.phone.trim(),
          email,
          role: params.role,
          status: 'pending', // Pending approval by Super Admin or database admin
          notes: params.notes || '',
        })
        .select()
        .single();

      if (profErr) {
        console.warn('[AuthService] Profile upsert warning:', profErr.message);
      }

      return {
        profile: (profile as UserProfile) || ({
          id: authData.user.id,
          username: params.username.trim(),
          full_name: params.fullName.trim(),
          phone: params.phone.trim(),
          email,
          role: params.role,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as UserProfile),
        error: null,
      };
    } catch (err: any) {
      return { profile: null, error: err.message || 'خطا در ایجاد حساب' };
    }
  }

  /**
   * Register a new client created by an operator or admin (Client Onboarding)
   */
  public async createClientAccount(params: {
    username: string;
    fullName: string;
    phone: string;
    password: string;
    createdById: string;
    notes?: string;
  }): Promise<{ profile: UserProfile | null; error: string | null }> {
    try {
      const email = normalizeAuthEmail(params.username);
      
      const { data: authData, error: authErr } = await supabaseNonPersist.auth.signUp({
        email,
        password: params.password,
        options: {
          data: {
            username: params.username.trim(),
            full_name: params.fullName.trim(),
            phone: params.phone.trim(),
            role: 'client',
            created_by: params.createdById,
          },
        },
      });

      if (authErr || !authData.user) {
        return {
          profile: null,
          error: authErr?.message?.includes('User already registered')
            ? 'این نام کاربری یا شماره برای مشتری دیگری ثبت شده است'
            : (authErr?.message || 'خطا در ثبت حساب مشتری'),
        };
      }

      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          username: params.username.trim(),
          full_name: params.fullName.trim(),
          phone: params.phone.trim(),
          email,
          role: 'client',
          status: 'approved',
          created_by: params.createdById,
          notes: params.notes || '',
        })
        .select()
        .single();

      if (profErr) {
        console.warn('[AuthService] Client profile insert warning:', profErr.message);
      }

      return { profile: profile as UserProfile, error: null };
    } catch (err: any) {
      return { profile: null, error: err.message || 'خطا در ساخت حساب مشتری' };
    }
  }

  /**
   * Super Admin: Fetch all staff members (pending, approved, suspended)
   */
  public async getStaffList(): Promise<UserProfile[]> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['staff', 'super_admin'])
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[AuthService] getStaffList error:', error.message);
        return [];
      }

      return (data as UserProfile[]) || [];
    } catch (e) {
      console.warn('[AuthService] getStaffList exception:', e);
      return [];
    }
  }

  /**
   * Super Admin: Approve pending staff account
   */
  public async approveStaff(staffId: string, adminId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          status: 'approved',
          approved_by: adminId,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', staffId);

      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Super Admin: Suspend or deactivate staff account
   */
  public async suspendStaff(staffId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          status: 'suspended',
          updated_at: new Date().toISOString(),
        })
        .eq('id', staffId);

      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Super Admin / Staff: Fetch all registered clients
   */
  public async getClientsList(): Promise<UserProfile[]> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'client')
        .order('created_at', { ascending: false });

      if (error) return [];
      return (data as UserProfile[]) || [];
    } catch {
      return [];
    }
  }

  /**
   * Get Active Session and Profile
   */
  public async getActiveUserProfile(): Promise<UserProfile | null> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        return null;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionData.session.user.id)
        .maybeSingle();

      return (profile as UserProfile) || null;
    } catch {
      return null;
    }
  }

  /**
   * Sign Out
   */
  public async signOut(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[AuthService] signOut error:', e);
    }
  }
}

export const globalAuthService = new AuthService();
