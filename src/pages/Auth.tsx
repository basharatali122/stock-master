import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Package, Mail, Lock, User, Phone, AlertCircle, CheckCircle } from 'lucide-react';

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { login, register, user, isApproved } = useAuth();
  const navigate = useNavigate();

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');

  // Redirect if already logged in and approved
  useEffect(() => {
    if (user && isApproved) {
      navigate('/dashboard');
    }
  }, [user, isApproved, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(loginEmail, loginPassword);
    
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Login failed');
    }
    
    setIsLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    const result = await register({
      name: registerName,
      email: registerEmail,
      phone: registerPhone,
      password: registerPassword,
    });

    if (result.success) {
      if (result.error) {
        // This is actually the success message for pending approval
        setSuccess(result.error);
        setRegisterName('');
        setRegisterEmail('');
        setRegisterPhone('');
        setRegisterPassword('');
        // Switch to login tab
        setIsLogin(true);
      }
    } else {
      setError(result.error || 'Registration failed');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        {/* Left Panel - Branding */}
        <div className="hidden w-1/2 bg-primary lg:flex lg:flex-col lg:justify-between lg:p-12">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/20">
                <Package className="h-7 w-7 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-primary-foreground">ARTRADERS</h1>
                <p className="text-sm text-primary-foreground/80">Distribution Management System</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-4xl font-bold leading-tight text-primary-foreground">
              Streamline Your Distribution Operations
            </h2>
            <p className="text-lg text-primary-foreground/80">
              Manage routes, orders, inventory, and financials all in one place. 
              Built for efficiency, designed for growth.
            </p>
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="rounded-xl bg-primary-foreground/10 p-4">
                <p className="text-3xl font-bold text-primary-foreground">500+</p>
                <p className="text-sm text-primary-foreground/70">Active Shops</p>
              </div>
              <div className="rounded-xl bg-primary-foreground/10 p-4">
                <p className="text-3xl font-bold text-primary-foreground">50+</p>
                <p className="text-sm text-primary-foreground/70">Routes Covered</p>
              </div>
              <div className="rounded-xl bg-primary-foreground/10 p-4">
                <p className="text-3xl font-bold text-primary-foreground">1000+</p>
                <p className="text-sm text-primary-foreground/70">Daily Orders</p>
              </div>
              <div className="rounded-xl bg-primary-foreground/10 p-4">
                <p className="text-3xl font-bold text-primary-foreground">98%</p>
                <p className="text-sm text-primary-foreground/70">Delivery Rate</p>
              </div>
            </div>
          </div>

          <p className="text-sm text-primary-foreground/60">
            © 2024 ARTRADERS. All rights reserved.
          </p>
        </div>

        {/* Right Panel - Auth Form */}
        <div className="flex w-full flex-col justify-center px-8 lg:w-1/2 lg:px-16">
          <div className="mx-auto w-full max-w-md">
            {/* Mobile Logo */}
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <Package className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-bold text-foreground">ARTRADERS</h1>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground">
                {isLogin ? 'Welcome back' : 'Create an account'}
              </h2>
              <p className="mt-2 text-muted-foreground">
                {isLogin
                  ? 'Enter your credentials to access your account'
                  : 'Register as an Order Booker to get started'}
              </p>
            </div>

            {/* Tab Switcher */}
            <div className="mb-6 flex rounded-lg bg-muted p-1">
              <button
                onClick={() => {
                  setIsLogin(true);
                  setError('');
                }}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                  isLogin
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => {
                  setIsLogin(false);
                  setError('');
                  setSuccess('');
                }}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                  !isLogin
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Register
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <p>{success}</p>
              </div>
            )}

            {isLogin ? (
              /* Login Form */
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="input-field pl-10"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="input-field pl-10"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary w-full"
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            ) : (
              /* Register Form */
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      placeholder="John Doe"
                      className="input-field pl-10"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="input-field pl-10"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="tel"
                      value={registerPhone}
                      onChange={(e) => setRegisterPhone(e.target.value)}
                      placeholder="+92 300 1234567"
                      className="input-field pl-10"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="password"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      placeholder="••••••••"
                      className="input-field pl-10"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Note: Your account will need admin approval before you can login.
                </p>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary w-full"
                >
                  {isLoading ? 'Creating account...' : 'Create Account'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
