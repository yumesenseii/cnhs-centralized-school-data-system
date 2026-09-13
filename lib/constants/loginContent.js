export const LOGIN_COLORS = {
  green: "#174D37",
  greenDark: "#123D2C",
  gold: "#F4C430",
};

export const loginContent = {
  schoolName: "Cambaog National High School",
  brandingPanelSrc: "/assets/images/login/branding-panel.png",
  backgroundSrc: "/assets/images/login/cnhs-building.png",
  form: {
    title: "Login",
    subtitle: "Sign in to CNHS Learn",
    usernameLabel: "Username or email",
    usernamePlaceholder: "Enter your username or email",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter your password",
    rememberMe: "Remember me",
    forgotPassword: "Forgot password?",
    forgotTitle: "Reset password",
    forgotHint:
      "Enter the email on your CNHS Learn account. If an account exists, we will send a reset link.",
    forgotEmailLabel: "Email",
    forgotEmailPlaceholder: "Enter your email",
    forgotSubmit: "Send reset link",
    forgotSent:
      "If an account exists for that email, a reset link was sent. Check your inbox and spam folder.",
    forgotClose: "Close",
    resetTitle: "Set a new password",
    resetSubtitle:
      "This link was opened from your account email. Choose a strong password with at least 8 characters to protect your CNHS Learn account.",
    resetPasswordLabel: "New password",
    resetConfirmLabel: "Confirm password",
    resetSubmit: "Update password",
    resetInvalid:
      "This reset link is invalid or has expired. Request a new link from the login page.",
    resetMismatch: "Passwords do not match.",
    resetTooShort: "Password must be at least 8 characters.",
    resetSuccess: "Password updated. Sign in with your new password.",
    resetBack: "Back to login",
    firstLoginTitle: "Finish setting up your account",
    firstLoginSubtitle:
      "Change the temporary password from your email, then accept the Terms of Use and Privacy Policy to continue.",
    firstLoginCurrentLabel: "Temporary password",
    firstLoginNewLabel: "New password",
    firstLoginConfirmLabel: "Confirm new password",
    firstLoginAcceptPrefix: "I accept the ",
    firstLoginAcceptLink: "Terms of Use and Privacy Policy",
    firstLoginAcceptSuffix: " for CNHS Learn.",
    firstLoginPasswordHint:
      "8–32 characters, with at least one uppercase letter, one lowercase letter, and one number.",
    firstLoginPasswordPolicy:
      "Password must be 8–32 characters and include an uppercase letter, a lowercase letter, and a number.",
    firstLoginPasswordSame:
      "New password must be different from the temporary password.",
    firstLoginSubmit: "Save and continue",
    firstLoginTermsTitle: "Terms of Use and Privacy Policy",
    firstLoginTerms:
      "CNHS Learn stores school records for Cambaog National High School, including learner grades, attendance, and teacher submissions. Use this account only for official school work. Do not share your password. Learner data must stay inside the school and may be accessed by authorized Head Teachers for monitoring and reports. Contact the Head Teacher or ICT coordinator if you did not request this account.",
    submit: "Sign in",
    help: "Need help? Contact the IT Department",
  },
  validation: {
    emptyFields: "Please enter your email and password.",
    emailRequired: "Email is required.",
    passwordRequired: "Password is required.",
  },
  errors: {
    invalidCredentials: "Incorrect email or password.",
    accountInactive: "This account is inactive. Contact the administrator.",
    networkError: "Network error. Check your connection and try again.",
  },
  redirects: {
    admin: "/dashboard",
    administrator: "/dashboard",
    teacher: "/teacher/dashboard",
    student: "/dashboard",
  },
};
