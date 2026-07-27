              <label className="block text-sm font-medium mb-2">{t('password')}</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full"
                minLength={6}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
              size="lg"
            >
              {loading ? '...' : (isSignUp ? t('signUp') : t('signIn'))}
            </Button>
          </form>
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {isSignUp ? t('alreadyHaveAccount') : t('dontHaveAccount')}
          </button>
        </div>
        <div className={`hidden md:flex flex-col items-center justify-center p-12 h-full bg-gradient-to-br from-primary via-primary to-accent transition-opacity duration-500 ease-in-out ${isSignUp ? 'md:order-1 opacity-100' : 'md:order-2 opacity-100'}`}>
          <img 
            src={plLogo} 
            alt="Premier League" 
            className="w-64 h-auto mb-8 brightness-0 invert"
          />
        </div>
      </div>
    </div>
  );
}
