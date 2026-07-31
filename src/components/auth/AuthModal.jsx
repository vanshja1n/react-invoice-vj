import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function AuthModal({ open, onOpenChange, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { loading, signup, login, loginWithGoogle } = useAuth();

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setEmail('');
      setPassword('');
      setName('');
    }
  }, [open, initialMode]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      let res;
      if (mode === 'signup') {
        res = await signup(email, password, name);
      } else {
        res = await login(email, password);
      }
      toast.success(mode === 'signup' ? 'Account created successfully' : 'Logged in successfully');
      onOpenChange(false);
      return res;
    } catch (err) {
      toast.error(err.message || 'Authentication failed');
    }
  };

  const handleGoogle = async () => {
    try {
      if (!window.google?.accounts?.id) {
        toast.error('Google Sign-In is not configured');
        return;
      }
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) {
        toast.error('Google Client ID not configured');
        return;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        ux_mode: 'popup',
        itp_support: true,
        callback: async (response) => {
          if (!response.credential) {
            toast.error('Google Sign-In did not return a credential');
            return;
          }
          try {
            await loginWithGoogle(response.credential);
            toast.success('Logged in with Google successfully');
            onOpenChange(false);
          } catch (err) {
            toast.error(err.message || 'Google Sign-In failed');
          }
        },
      });
      let wrapper = document.getElementById('google_gsi_btn_host');
      if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'google_gsi_btn_host';
        wrapper.setAttribute(
          'style',
          'position:fixed;left:-9999px;top:-9999px;width:0;height:0;overflow:hidden;'
        );
        document.body.appendChild(wrapper);
      }
      wrapper.innerHTML = '';
      window.google.accounts.id.renderButton(wrapper, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        logo_alignment: 'left',
      });
      const nativeBtn = wrapper.querySelector('div[role="button"]') || wrapper.firstElementChild;
      if (nativeBtn) {
        nativeBtn.click();
      } else {
        toast.error('Failed to open Google Sign-In');
      }
    } catch (err) {
      toast.error(err.message || 'Google Sign-In failed');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-semibold">
                {mode === 'signup' ? 'Create an account' : 'Welcome back'}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                {mode === 'signup'
                  ? 'Start syncing your invoices to the cloud.'
                  : 'Login to access your data across devices.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-medium">Full name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                required
                className="h-9"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                className="h-9 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full h-9" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'signup' ? 'Create account' : 'Login'}
          </Button>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-2 text-[10px] uppercase tracking-wider text-muted-foreground">or</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full h-9"
            onClick={handleGoogle}
            disabled={loading}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>
        </form>

        <div className="px-6 py-4 border-t border-border text-center text-xs text-muted-foreground">
          {mode === 'signup' ? (
            <>Already have an account?{' '}
              <button
                type="button"
                className="text-primary font-medium hover:underline"
                onClick={() => setMode('login')}
                disabled={loading}
              >
                Login
              </button>
            </>
          ) : (
            <>Don&apos;t have an account?{' '}
              <button
                type="button"
                className="text-primary font-medium hover:underline"
                onClick={() => setMode('signup')}
                disabled={loading}
              >
                Sign up
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AuthModal;
