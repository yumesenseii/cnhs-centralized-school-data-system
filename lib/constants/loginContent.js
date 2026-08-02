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
    subtitle: "Access your account",
    usernameLabel: "Username or email",
    usernamePlaceholder: "Enter your username or email",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter your password",
    rememberMe: "Remember me",
    forgotPassword: "Forgot password?",
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
