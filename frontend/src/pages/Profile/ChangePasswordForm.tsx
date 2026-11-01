import React, { useState } from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { Lock, Shield, Loader2, Eye, EyeOff } from 'lucide-react';
import { PasswordFormValues } from './profileSchemas';

interface ChangePasswordFormProps {
  register: UseFormRegister<PasswordFormValues>;
  errors: FieldErrors<PasswordFormValues>;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  isSubmitting: boolean;
}

export function ChangePasswordForm({
  register,
  errors,
  onSubmit,
  isSubmitting
}: ChangePasswordFormProps) {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className="lg:col-span-5">
      <div className="surface-panel p-6 sm:p-7 relative overflow-hidden h-full shadow-xl">
        <div className="flex items-center gap-3.5 mb-6 relative z-10 border-b border-border-subtle pb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-secondary/15 border border-brand-secondary/30 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-brand-secondary" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Bảo Mật & Mật Khẩu</h2>
            <p className="text-xs text-text-secondary">Thay đổi mật khẩu đăng nhập tài khoản.</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3.5 relative z-10" noValidate>
          <div className="space-y-1">
            <label htmlFor="password-current" className="text-xs font-bold text-text-secondary uppercase">Mật khẩu hiện tại</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-text-secondary group-focus-within:text-brand-secondary transition-colors" aria-hidden="true" />
              </div>
              <input 
                id="password-current"
                autoComplete="current-password"
                type={showCurrentPassword ? 'text' : 'password'}
                aria-invalid={errors.currentPassword ? 'true' : 'false'}
                aria-describedby={errors.currentPassword ? 'password-current-error' : undefined}
                {...register('currentPassword')}
                placeholder="••••••••"
                className={`block w-full pl-10 pr-10 py-2 text-xs sm:text-sm border ${
                  errors.currentPassword ? 'border-danger' : 'border-border-subtle'
                } rounded-xl bg-surface-2/50 text-white placeholder-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary transition-[border-color,background-color,box-shadow] hover:bg-surface-2`}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword((prev) => !prev)}
                aria-label={showCurrentPassword ? 'Ẩn mật khẩu hiện tại' : 'Hiện mật khẩu hiện tại'}
                aria-pressed={showCurrentPassword}
                className="absolute inset-y-0 right-0 px-3.5 min-w-11 min-h-11 flex items-center justify-center text-text-tertiary hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary rounded-xl cursor-pointer"
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
            {errors.currentPassword && (
              <p id="password-current-error" role="alert" className="text-[11px] text-danger pl-1 animate-slide-up">{errors.currentPassword.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="password-new" className="text-xs font-bold text-text-secondary uppercase">Mật khẩu mới</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Shield className="h-4 w-4 text-text-secondary group-focus-within:text-brand-secondary transition-colors" aria-hidden="true" />
              </div>
              <input 
                id="password-new"
                autoComplete="new-password"
                type={showNewPassword ? 'text' : 'password'}
                aria-invalid={errors.newPassword ? 'true' : 'false'}
                aria-describedby={errors.newPassword ? 'password-new-error' : undefined}
                {...register('newPassword')}
                placeholder="••••••••"
                className={`block w-full pl-10 pr-10 py-2 text-xs sm:text-sm border ${
                  errors.newPassword ? 'border-danger' : 'border-border-subtle'
                } rounded-xl bg-surface-2/50 text-white placeholder-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary transition-[border-color,background-color,box-shadow] hover:bg-surface-2`}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                aria-label={showNewPassword ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
                aria-pressed={showNewPassword}
                className="absolute inset-y-0 right-0 px-3.5 min-w-11 min-h-11 flex items-center justify-center text-text-tertiary hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary rounded-xl cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
            {errors.newPassword && (
              <p id="password-new-error" role="alert" className="text-[11px] text-danger pl-1 animate-slide-up">{errors.newPassword.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="password-confirm" className="text-xs font-bold text-text-secondary uppercase">Xác nhận mật khẩu mới</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Shield className="h-4 w-4 text-text-secondary group-focus-within:text-brand-secondary transition-colors" aria-hidden="true" />
              </div>
              <input 
                id="password-confirm"
                autoComplete="new-password"
                type={showConfirmPassword ? 'text' : 'password'}
                aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                aria-describedby={errors.confirmPassword ? 'password-confirm-error' : undefined}
                {...register('confirmPassword')}
                placeholder="••••••••"
                className={`block w-full pl-10 pr-10 py-2 text-xs sm:text-sm border ${
                  errors.confirmPassword ? 'border-danger' : 'border-border-subtle'
                } rounded-xl bg-surface-2/50 text-white placeholder-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary transition-[border-color,background-color,box-shadow] hover:bg-surface-2`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? 'Ẩn xác nhận mật khẩu' : 'Hiện xác nhận mật khẩu'}
                aria-pressed={showConfirmPassword}
                className="absolute inset-y-0 right-0 px-3.5 min-w-11 min-h-11 flex items-center justify-center text-text-tertiary hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary rounded-xl cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p id="password-confirm-error" role="alert" className="text-[11px] text-danger pl-1 animate-slide-up">{errors.confirmPassword.message}</p>
            )}
          </div>

          <div className="pt-2">
            <button 
              type="submit" 
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="w-full min-h-11 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white font-bold rounded-xl transition-[background-color,transform] inline-flex items-center justify-center gap-1.5 text-sm disabled:opacity-50 active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Lock className="w-4 h-4" aria-hidden="true" />
              )}
              <span>Cập Nhật Mật Khẩu</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
