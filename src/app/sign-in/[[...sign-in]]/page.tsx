import { SignIn } from '@clerk/nextjs';
import { AuthLayout, clerkAppearance } from '@/components/auth/AuthLayout';

export default function SignInPage() {
  return (
    <AuthLayout line="Pick up your maps where you left off.">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/app"
        appearance={clerkAppearance}
      />
    </AuthLayout>
  );
}
