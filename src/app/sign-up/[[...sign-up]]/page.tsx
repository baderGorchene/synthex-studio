import { SignUp } from '@clerk/nextjs';
import { AuthLayout, clerkAppearance } from '@/components/auth/AuthLayout';

export default function SignUpPage() {
  return (
    <AuthLayout variant="sign-up">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/app"
        appearance={clerkAppearance}
      />
    </AuthLayout>
  );
}
