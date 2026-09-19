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
      "Enter the email address linked to your CNHS Learn account. We will send instructions to reset your password.",
    forgotEmailLabel: "Email",
    forgotEmailPlaceholder: "Enter your email",
    forgotSubmit: "Send reset link",
    forgotSent:
      "Please check your email for instructions to reset your password. If you do not see it, look in your Junk or Spam folder.",
    forgotSentRetry:
      "If you still do not receive an email, wait a few minutes and try again, or ask your Head Teacher for help resetting your password.",
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
    firstLoginTermsSchool: "Cambaog National High School",
    firstLoginTermsSystem: "CNHS Learn",
    firstLoginTermsEffective: "Effective upon first sign-in",
    firstLoginTermsArticles: [
      {
        number: "1",
        title: "Introduction",
        body: "These Terms govern access to and use of CNHS Learn, the official school data system of Cambaog National High School. By creating a password and accepting these Terms, you agree to use the system only for authorized school purposes.",
      },
      {
        number: "2",
        title: "Purpose of the System",
        body: "CNHS Learn stores and processes official school records, including learner grades, attendance, class assignments, lesson-plan submissions, and related reports.",
      },
      {
        number: "3",
        title: "Authorized Users",
        body: "Access is limited to accounts issued by the school. Use only the account assigned to you.",
      },
      {
        number: "4",
        title: "Acceptable Use",
        body: "Use the system solely for official DepEd / school work. Do not share your password, allow another person to use your account, copy learner records for personal use, or disclose information outside authorized school channels.",
      },
      {
        number: "5",
        title: "Confidentiality and Learner Data",
        body: "Learner information is confidential. Records shall remain within the school and may be accessed only by authorized personnel, including the Head Teacher, for monitoring, reporting, and official administration, consistent with the Data Privacy Act of 2012 (Republic Act No. 10173).",
      },
      {
        number: "6",
        title: "Account Security",
        body: "You are responsible for your password and activity under your account. If you did not request this account or suspect unauthorized access, contact the Head Teacher or ICT coordinator immediately.",
      },
      {
        number: "7",
        title: "Acceptance",
        body: "Continued use of CNHS Learn constitutes acceptance of these Terms. The version presented at first sign-in applies until a later version is issued.",
      },
      {
        number: "8",
        title: "Contact",
        body: "Head Teacher or ICT coordinator, Cambaog National High School.",
      },
    ],
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
