import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, User, ArrowRight, Loader2, Zap, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { useAuthStore } from '../../stores/useAuthStore';

const registerSchema = z.object({
  name: z.string().min(2, 'Họ và tên phải có ít nhất 2 ký tự').max(100, 'Họ và tên tối đa 100 ký tự'),
  email: z.string().min(1, 'Email không được để trống').email('Địa chỉ email không đúng định dạng'),
  password: z
    .string()
    .min(8, 'Mật khẩu phải chứa ít nhất 8 ký tự')
    .regex(/[A-Za-z]/, 'Mật khẩu phải chứa ít nhất một chữ cái')
    .regex(/[0-9]/, 'Mật khẩu phải chứa ít nhất một chữ số'),
  confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu')
}).refine(data => data.password === data.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword']
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const user = useAuthStore(state => state.user);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  const resolveRedirectTarget = (role?: string) => {
    const stateFrom = (location.state as { from?: unknown })?.from;
    let targetPath = '';

    if (typeof stateFrom === 'string') {
      targetPath = stateFrom;
    } else if (stateFrom && typeof stateFrom === 'object' && 'pathname' in stateFrom) {
      const locObj = stateFrom as { pathname: string; search?: string; hash?: string };
      targetPath = `${locObj.pathname}${locObj.search || ''}${locObj.hash || ''}`;
    } else {
      const searchParams = new URLSearchParams(location.search);
      const fromQuery = searchParams.get('from');
      if (fromQuery && fromQuery.startsWith('/') && !fromQuery.startsWith('//')) {
        targetPath = fromQuery;
      }
    }

    // Guard against open redirect and auth loop
    if (!targetPath || targetPath.startsWith('/login') || targetPath.startsWith('/register') || !targetPath.startsWith('/') || targetPath.startsWith('//')) {
      if (role === 'Staff') return '/admin/scan-ticket';
      if (role === 'Admin') return '/admin';
      return '/';
    }

    if (role === 'Staff' && targetPath === '/admin') {
      return '/admin/scan-ticket';
    }

    return targetPath;
  };

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      navigate(resolveRedirectTarget(user?.role), { replace: true });
    }
  }, [isAuthenticated, user?.role, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    }
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setServerError('');

    try {
      const payload = {
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password
      };
      const res = await api.post('/api/auth/register', payload);
      if (res.data.success) {
        const data = res.data.data;
        if (data?.userId) {
          const userData = {
            id: data.userId,
            name: data.name || values.name.trim(),
            email: data.email || values.email.trim(),
            role: data.role || 'Customer',
            avatarUrl: data.avatarUrl || undefined
          };
          useAuthStore.getState().setAuth(userData, data.token ?? null);
        }
        toast.success('Đăng ký tài khoản thành công!');
        navigate(resolveRedirectTarget(data?.role), { replace: true });
      } else {
        const msg = res.data.message || 'Đăng ký thất bại';
        setServerError(msg);
        toast.error(msg);
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      const msg = apiErr.response?.data?.message || 'Đăng ký thất bại. Email có thể đã được sử dụng.';
      setServerError(msg);
      toast.error(msg);
    }
  };

  return (
    <main id="main-content" tabIndex={-1} className="min-h-dvh bg-surface-base flex items-center justify-center p-4 relative overflow-hidden text-text-primary py-12 focus:outline-none">
      {/* Decorative Grid */}
      <div className="w-full max-w-md relative z-10 animate-modal-pop">
        {/* Sleek Floating Panel */}
        <div className="surface-panel p-6 sm:p-8 rounded-2xl relative overflow-hidden">
          {/* Subtle top highlight */}
          
          <div className="text-center mb-8">
          <Link to="/" aria-label="Về trang chủ TickeX" className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-surface-2 border border-border-focus mb-4 hover:bg-surface-3 transition-colors group">
              <Zap className="w-6 h-6 text-brand-primary group-hover:text-white transition-colors" aria-hidden="true" />
            </Link>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white mb-1 tracking-tight">Tạo Tài Khoản Mới</h1>
            <p className="text-text-secondary text-xs sm:text-sm">Trở thành thành viên TickeX để đặt vé sự kiện dễ dàng</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" noValidate>
            {serverError && (
              <div role="alert" aria-live="polite" className="p-3.5 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs font-medium animate-slide-up">
                {serverError}
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="register-name" className="block text-xs font-medium text-text-secondary">
                Họ và tên
              </label>
              <div className="group relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-text-tertiary group-focus-within:text-brand-primary transition-colors" aria-hidden="true" />
                </div>
                <input
                  type="text"
                  id="register-name"
                  {...register('name')}
                  autoComplete="name"
                  aria-invalid={errors.name ? 'true' : 'false'}
                  aria-describedby={errors.name ? 'register-name-error' : undefined}
                  className={`block w-full min-h-11 pl-10 pr-3.5 py-2.5 bg-surface-2 border ${
                    errors.name ? 'border-danger focus:border-danger focus:ring-danger' : 'border-border-subtle focus:border-brand-primary focus:ring-brand-primary'
                  } rounded-xl text-white placeholder-text-tertiary focus:outline-none focus-visible:ring-2 transition-[border-color,background-color,box-shadow] text-xs sm:text-sm`}
                  placeholder="Họ và tên (VD: Nguyễn Văn An)"
                />
              </div>
              {errors.name && (
                <p id="register-name-error" role="alert" className="text-[11px] text-danger pl-1 animate-slide-up">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="register-email" className="block text-xs font-medium text-text-secondary">
                Email
              </label>
              <div className="group relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-text-tertiary group-focus-within:text-brand-primary transition-colors" aria-hidden="true" />
                </div>
                <input
                  type="email"
                  id="register-email"
                  {...register('email')}
                  autoComplete="email"
                  aria-invalid={errors.email ? 'true' : 'false'}
                  aria-describedby={errors.email ? 'register-email-error' : undefined}
                  className={`block w-full min-h-11 pl-10 pr-3.5 py-2.5 bg-surface-2 border ${
                    errors.email ? 'border-danger focus:border-danger focus:ring-danger' : 'border-border-subtle focus:border-brand-primary focus:ring-brand-primary'
                  } rounded-xl text-white placeholder-text-tertiary focus:outline-none focus-visible:ring-2 transition-[border-color,background-color,box-shadow] text-xs sm:text-sm`}
                  placeholder="Địa chỉ email (VD: an.nguyen@example.com)"
                />
              </div>
              {errors.email && (
                <p id="register-email-error" role="alert" className="text-[11px] text-danger pl-1 animate-slide-up">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="register-password" className="block text-xs font-medium text-text-secondary">
                Mật khẩu
              </label>
              <div className="group relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-text-tertiary group-focus-within:text-brand-primary transition-colors" aria-hidden="true" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="register-password"
                  {...register('password')}
                  autoComplete="new-password"
                  aria-invalid={errors.password ? 'true' : 'false'}
                  aria-describedby={errors.password ? 'register-password-error' : undefined}
                  className={`block w-full min-h-11 pl-10 pr-10 py-2.5 bg-surface-2 border ${
                    errors.password ? 'border-danger focus:border-danger focus:ring-danger' : 'border-border-subtle focus:border-brand-primary focus:ring-brand-primary'
                  } rounded-xl text-white placeholder-text-tertiary focus:outline-none focus-visible:ring-2 transition-[border-color,background-color,box-shadow] text-xs sm:text-sm`}
                  placeholder="Mật khẩu (tối thiểu 8 ký tự, gồm chữ và số)"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 px-3.5 min-w-11 min-h-11 flex items-center justify-center text-text-tertiary hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded-xl"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              {errors.password && (
                <p id="register-password-error" role="alert" className="text-[11px] text-danger pl-1 animate-slide-up">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="register-confirm-password" className="block text-xs font-medium text-text-secondary">
                Xác nhận mật khẩu
              </label>
              <div className="group relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-text-tertiary group-focus-within:text-brand-primary transition-colors" aria-hidden="true" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="register-confirm-password"
                  {...register('confirmPassword')}
                  autoComplete="new-password"
                  aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                  aria-describedby={errors.confirmPassword ? 'register-confirm-password-error' : undefined}
                  className={`block w-full min-h-11 pl-10 pr-10 py-2.5 bg-surface-2 border ${
                    errors.confirmPassword ? 'border-danger focus:border-danger focus:ring-danger' : 'border-border-subtle focus:border-brand-primary focus:ring-brand-primary'
                  } rounded-xl text-white placeholder-text-tertiary focus:outline-none focus-visible:ring-2 transition-[border-color,background-color,box-shadow] text-xs sm:text-sm`}
                  placeholder="Xác nhận lại mật khẩu"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? 'Ẩn xác nhận mật khẩu' : 'Hiện xác nhận mật khẩu'}
                  aria-pressed={showConfirmPassword}
                  className="absolute inset-y-0 right-0 px-3.5 min-w-11 min-h-11 flex items-center justify-center text-text-tertiary hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded-xl"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p id="register-confirm-password-error" role="alert" className="text-[11px] text-danger pl-1 animate-slide-up">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="group w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-brand-primary hover:bg-brand-primary/90 shadow-brand-glow cursor-pointer transition-[background-color,transform,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98] mt-4"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <>
                  <span>Đăng Ký Tài Khoản</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-text-secondary">
            Bạn đã có tài khoản?{' '}
            <Link to="/login" className="font-bold text-white hover:text-brand-primary transition-colors">
              Đăng nhập ngay
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
